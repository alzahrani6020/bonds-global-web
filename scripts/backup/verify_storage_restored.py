#!/usr/bin/env python3
"""Verify an isolated, decrypted BONDS Storage tar without extracting files."""
import argparse
import hashlib
import json
from pathlib import Path
import sys
import tarfile


def verify(path):
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
        buckets = manifest.get("buckets")
        if (not isinstance(buckets, list) or not buckets or
                any(not isinstance(b, str) or not b or "/" in b for b in buckets) or
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
                    "\\x00" in object_path or any(p in ("", ".", "..") for p in object_path.split("/"))):
                raise ValueError("invalid bucket/object path")
            pair = (bucket, object_path)
            if pair in seen_paths:
                raise ValueError("duplicate object path")
            seen_paths.add(pair)
        expected = {"manifest.json"}
        for index, item in enumerate(objects):
            blob = "blobs/%08d" % index
            if item.get("blob") != blob:
                raise ValueError("unexpected blob path")
            if len(item.get("sha256", "")) != 64 or item.get("size", -1) < 0:
                raise ValueError("invalid object metadata")
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
        print(json.dumps({"status": "PASS", "objects": len(objects),
                          "verified": len(objects)}, sort_keys=True))


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--archive", type=Path, required=True)
    args = parser.parse_args()
    try:
        verify(args.archive)
    except (OSError, ValueError, TypeError, KeyError, tarfile.TarError,
            json.JSONDecodeError) as exc:
        print("STATUS: FAIL - STORAGE_RESTORE_CHECK (" +
              type(exc).__name__ + ")", file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main()
