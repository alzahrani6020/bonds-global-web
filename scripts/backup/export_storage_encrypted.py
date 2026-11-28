#!/usr/bin/env python3
"""Read-only Supabase Storage blob export, manifest and AGE encryption.

No service-role credential, plaintext blob, or plaintext manifest is uploaded.
The export is best-effort point-in-time: concurrent writes cannot be frozen.
"""
import argparse
import hashlib
import json
import os
from pathlib import Path
import shutil
import subprocess
import sys
import tarfile
import tempfile
from urllib.error import HTTPError, URLError
from urllib.parse import quote, urlencode
from urllib.request import Request, urlopen

PROJECT = "hutxsqzplyuqgnghsrcs"

MAX_OBJECTS = 100000
MAX_TOTAL_BYTES = 2 * 1024 ** 3
PAGE_SIZE = 100


def request_json(url, key, payload):
    body = json.dumps(payload).encode("utf-8")
    req = Request(url, data=body, method="POST", headers={
        "apikey": key,
        "Content-Type": "application/json",
    })
    with urlopen(req, timeout=45) as response:
        return json.load(response)


def list_buckets(base, key):
    """Exhaust paginated Storage bucket listing; reject duplicates or API drift."""
    names = []
    offset = 0
    while True:
        query = urlencode({"limit": PAGE_SIZE, "offset": offset,
                           "sortColumn": "name", "sortOrder": "asc"})
        req = Request(base + "/storage/v1/bucket?" + query,
                      method="GET", headers={
                          "apikey": key
                      })
        with urlopen(req, timeout=45) as response:
            entries = json.load(response)
        if not isinstance(entries, list):
            raise RuntimeError("invalid bucket listing response")
        page_names = [entry.get("id") for entry in entries
                      if isinstance(entry, dict)]
        if (len(page_names) != len(entries) or
                any(not isinstance(n, str) or not n for n in page_names)):
            raise RuntimeError("invalid bucket identifier")
        names.extend(page_names)
        if len(names) > 100000:
            raise RuntimeError("bucket inventory exceeds safety limit")
        if len(entries) < PAGE_SIZE:
            break
        offset += len(entries)
    if not names or len(names) != len(set(names)):
        raise RuntimeError("empty or duplicate bucket inventory")
    return sorted(names)

def inventory_bucket(base, key, bucket):
    """List all objects including nested folders, without relying on a short page."""
    result = []
    queue = [""]
    visited = set()
    while queue:
        prefix = queue.pop()
        if prefix in visited:
            raise RuntimeError("duplicate folder traversal")
        visited.add(prefix)
        offset = 0
        while True:
            entries = request_json(
                base + "/storage/v1/object/list/" + quote(bucket, safe=""),
                key,
                {"prefix": prefix, "limit": PAGE_SIZE, "offset": offset,
                 "sortBy": {"column": "name", "order": "asc"}},
            )
            if not isinstance(entries, list):
                raise RuntimeError("invalid storage listing response")
            for item in entries:
                name = item.get("name")
                if not isinstance(name, str) or not name or name in (".", ".."):
                    raise RuntimeError("invalid storage object name")
                path = prefix + name
                if item.get("id") is None:
                    queue.append(path.rstrip("/") + "/")
                    continue
                metadata = item.get("metadata") or {}
                size = metadata.get("size")
                if isinstance(size, bool) or not isinstance(size, (int, str)):
                    raise RuntimeError("missing storage object size metadata")
                size = int(size)
                if size < 0:
                    raise RuntimeError("negative storage object size")
                result.append({"bucket": bucket, "path": path,
                               "id": str(item["id"]), "size": size,
                               "updated_at": item.get("updated_at")})
                if len(result) > MAX_OBJECTS:
                    raise RuntimeError("object limit exceeded")
            if len(entries) < PAGE_SIZE:
                break
            offset += len(entries)
    result.sort(key=lambda x: (x["bucket"], x["path"]))
    if len({(i["bucket"], i["path"]) for i in result}) != len(result):
        raise RuntimeError("duplicate storage object path")
    return result


def inventory(base, key, buckets):
    objects = []
    for bucket in buckets:
        objects.extend(inventory_bucket(base, key, bucket))
        if len(objects) > MAX_OBJECTS:
            raise RuntimeError("global object inventory limit exceeded")
    objects.sort(key=lambda x: (x["bucket"], x["path"]))
    if not objects:
        raise RuntimeError("empty storage inventory: refuse incomplete backup")
    if sum(x["size"] for x in objects) > MAX_TOTAL_BYTES:
        raise RuntimeError("storage total exceeds safety limit")
    return objects


def download(base, key, bucket, path, target):
    url = (base + "/storage/v1/object/authenticated/" +
           quote(bucket, safe="") + "/" + quote(path, safe="/"))
    req = Request(url, method="GET", headers={
        "apikey": key
    })
    digest = hashlib.sha256()
    count = 0
    with urlopen(req, timeout=90) as response, open(target, "xb") as out:
        while True:
            chunk = response.read(1024 * 1024)
            if not chunk:
                break
            count += len(chunk)
            if count > MAX_TOTAL_BYTES:
                raise RuntimeError("download exceeds safety limit")
            digest.update(chunk)
            out.write(chunk)
    return count, digest.hexdigest()


def produce(base, key, recipient, destination, run_id):
    if not recipient.startswith("age1") or any(c.isspace() for c in recipient):
        raise RuntimeError("invalid AGE recipient")
    if not run_id.isdecimal():
        raise RuntimeError("invalid run identifier")
    if destination.exists():
        raise RuntimeError("refuse to overwrite encrypted archive")
    if not destination.parent.is_dir():
        raise RuntimeError("destination parent missing")
    buckets = list_buckets(base, key)
    starting = inventory(base, key, buckets)
    with tempfile.TemporaryDirectory(prefix="bonds-storage-", dir=os.getenv("RUNNER_TEMP")) as tmp:
        tmpdir = Path(tmp)
        (tmpdir / "blobs").mkdir()
        manifest = {"format": "bonds-storage-v1", "project": PROJECT,
                    "run_id": run_id, "buckets": buckets, "objects": []}
        for index, item in enumerate(starting):
            blob_name = "%08d" % index
            length, sha = download(base, key, item["bucket"], item["path"],
                                   tmpdir / "blobs" / blob_name)
            if length != item["size"]:
                raise RuntimeError("size mismatch in storage object: " +
                                   item["bucket"] + "/" + item["path"])
            manifest["objects"].append({**item, "blob": "blobs/" + blob_name,
                                        "sha256": sha})
        # A second listing detects added/deleted/changed object metadata.
        if list_buckets(base, key) != buckets or inventory(base, key, buckets) != starting:
            raise RuntimeError("inventory changed during export: reject inconsistent snapshot")
        (tmpdir / "manifest.json").write_text(
            json.dumps(manifest, sort_keys=True, ensure_ascii=False, indent=2),
            encoding="utf-8")
        archive = tmpdir / "storage-plaintext.tar"
        try:
            with tarfile.open(archive, "w") as tar:
                tar.add(tmpdir / "manifest.json", arcname="manifest.json", recursive=False)
                for i in range(len(starting)):
                    name = "%08d" % i
                    tar.add(tmpdir / "blobs" / name, arcname="blobs/" + name,
                            recursive=False)
            # Prove actual Storage bytes restore safely into a new isolated folder
            # and match their manifest hashes before sealing the archive.
            # The temporary folder is destroyed with the runner workspace.
            from verify_storage_restored import verify
            verify(archive, tmpdir / "restored-probe")
            # Write to a temporary encrypted path; rename only after age succeeds.
            encrypted_temp = destination.with_name(destination.name + ".partial")
            if encrypted_temp.exists():
                raise RuntimeError("encrypted partial output already exists")
            try:
                with encrypted_temp.open("xb") as out:
                    p = subprocess.run(["age", "-r", recipient, "-o", "-",
                                        str(archive)], stdout=out, check=False)
                if p.returncode != 0 or encrypted_temp.stat().st_size == 0:
                    raise RuntimeError("AGE encryption failed")
                encrypted_temp.rename(destination)
            finally:
                if encrypted_temp.exists():
                    encrypted_temp.unlink()
        finally:
            if archive.exists():
                archive.unlink()
    digest = hashlib.sha256()
    with destination.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    print(json.dumps({"status": "PASS", "run_id": run_id,
                      "objects": len(starting), "encrypted_bytes": destination.stat().st_size,
                      "encrypted_sha256": digest.hexdigest()}, sort_keys=True))


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--run-id", required=True)
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()
    key = os.environ.get("BONDS_STORAGE_SERVICE_ROLE_KEY", "")
    recipient = os.environ.get("BONDS_BACKUP_AGE_RECIPIENT", "")
    ref = os.environ.get("SUPABASE_PROJECT_REF", "")
    if ref != PROJECT or not key or not recipient:
        raise RuntimeError("missing scoped production credentials")
    produce("https://" + PROJECT + ".supabase.co", key,
            recipient, args.output, args.run_id)


if __name__ == "__main__":
    try:
        main()
    except (ValueError, OSError, HTTPError, URLError, RuntimeError,
            subprocess.SubprocessError) as exc:
        # Do not expose HTTP responses, credentials or object paths in CI failures.
        print("STATUS: FAIL - STORAGE_EXPORT (" + type(exc).__name__ + ")", file=sys.stderr)
        sys.exit(1)
