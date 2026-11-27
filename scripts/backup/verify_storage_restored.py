#!/usr/bin/env python3
"""Verify an isolated BONDS Storage tar; optionally restore into a new local directory."""
import argparse
import hashlib
import json
import os
import shutil
from pathlib import Path
import sys
import tarfile


def verify(path, restore_to=None):
    with tarfile.open(path, "r:") as archive:
        members = archive.getmembers()
        if not members or members[0].name != "manifest.json":
            raise ValueError("manifest must be first member")
        if any(not m.isfile() or m.issym() or m.islnk() for m in members):
            raise ValueError("non-regular tar member")
        if len(members) > 100002:
            raise ValueError("archive has too many members")
        header = archive.extractfile(members[0])
        if header is None or members[0].size > 20 * 1024 * 1024:
            raise ValueError("manifest invalid or oversized")
        manifest = json.load(header)
        objects = manifest.get("objects")
        if manifest.get("format") != "bonds-storage-v1" or not isinstance(objects, list):
            raise ValueError("unexpected manifest format")
        if manifest.get("project") != "hutxsqzplyuqgnghsrcs":
            raise ValueError("archive belongs to a different project")
        run_id = manifest.get("run_id")
        if not isinstance(run_id, str) or not run_id.isdecimal():
            raise ValueError("invalid archive run identifier")
        buckets = manifest.get("buckets")
        if (not isinstance(buckets, list) or not buckets or
                any(not isinstance(b, str) or not b or b in (".", "..") or
                    any(c in b for c in ("\\\\", "/", ":", "\\x00")) for b in buckets) or
                len(buckets) != len(set(buckets))):
            raise ValueError("invalid bucket coverage manifest")
        if not objects:
            raise ValueError("empty object manifest")
        seen_paths = set()
        for item in objects:
            if not isinstance(item, dict):
                raise ValueError("invalid object entry")
            bucket, object_path = item.get("bucket"), item.get("path")
            if (bucket not in buckets or not isinstance(object_path, str) or
                    not object_path or object_path.startswith("/") or
                    any(c in object_path for c in ("\\", ":", "\x00")) or
                    any(p in ("", ".", "..") for p in object_path.split("/"))):
                raise ValueError("invalid bucket/object path")
            pair = (bucket, object_path)
            if pair in seen_paths:
                raise ValueError("duplicate object path")
            seen_paths.add(pair)
        expected = {"manifest.json"}
        if len(objects) > 100000:
            raise ValueError("object count exceeds safety limit")
        total_bytes = 0
        for index, item in enumerate(objects):
            blob = "blobs/%08d" % index
            if item.get("blob") != blob:
                raise ValueError("unexpected blob path")
            size, digest = item.get("size"), item.get("sha256")
            if (type(size) is not int or size < 0 or
                    not isinstance(digest, str) or len(digest) != 64 or
                    any(ch not in "0123456789abcdef" for ch in digest)):
                raise ValueError("invalid object metadata")
            total_bytes += size
            if total_bytes > 2 * 1024 ** 3:
                raise ValueError("archive declared size exceeds safety limit")
            expected.add(blob)
        if {m.name for m in members} != expected or len(members) != len(expected):
            raise ValueError("archive members do not match manifest")
        by_name = {m.name: m for m in members}
        for item in objects:
            member = by_name[item["blob"]]
            if member.size != item["size"]:
                raise ValueError("size mismatch")
            stream = archive.extractfile(member)
            if stream is None:
                raise ValueError("missing object body")
            digest = hashlib.sha256()
            while True:
                chunk = stream.read(1024 * 1024)
                if not chunk:
                    break
                digest.update(chunk)
            if digest.hexdigest() != item["sha256"]:
                raise ValueError("checksum mismatch")
        # Only after the entire archive verifies may we create a recovery folder.
        # The destination must not already exist: never overwrite client data.
        if restore_to is not None:
            destination = Path(restore_to)
            if destination.exists() or destination.is_symlink():
                raise ValueError("restore destination already exists")
            if not destination.parent.is_dir() or destination.parent.is_symlink():
                raise ValueError("restore parent unavailable or symlinked")
            destination.mkdir(mode=0o700)
            try:
                for item in objects:
                    target = destination.joinpath(item["bucket"], *item["path"].split("/"))
                    target.parent.mkdir(parents=True, exist_ok=True)
                    member_stream = archive.extractfile(by_name[item["blob"]])
                    if member_stream is None:
                        raise ValueError("missing restored object")
                    with target.open("xb") as out:
                        shutil.copyfileobj(member_stream, out, length=1024 * 1024)
                    os.chmod(target, 0o600)
                # Verify actual bytes on disk, not only source tar streams.
                for item in objects:
                    target = destination.joinpath(item["bucket"], *item["path"].split("/"))
                    if target.stat().st_size != item["size"]:
                        raise ValueError("restored size mismatch")
                    with target.open("rb") as inp:
                        digest = hashlib.file_digest(inp, "sha256").hexdigest()
                    if digest != item["sha256"]:
                        raise ValueError("restored digest mismatch")
            except Exception:
                # Leave recovery output intact for forensic inspection.
                raise
        print(json.dumps({"status": "PASS", "objects": len(objects),
                          "verified": len(objects), "restored": len(objects) if restore_to is not None else 0}, sort_keys=True))


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--archive", type=Path, required=True)
    parser.add_argument("--restore-to", type=Path, help="new, nonexisting isolated recovery directory")
    args = parser.parse_args()
    try:
        verify(args.archive, args.restore_to)
    except (OSError, ValueError, TypeError, KeyError, tarfile.TarError,
            json.JSONDecodeError) as exc:
        print("STATUS: FAIL - STORAGE_RESTORE_CHECK (" +
              type(exc).__name__ + ")", file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main()
