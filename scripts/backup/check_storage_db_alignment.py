#!/usr/bin/env python3
"""Compare verified Storage archive manifest with isolated PostgreSQL Storage metadata.

Read-only. Never connects to production. JSON must be exported from an isolated
restored database, not from a later live production snapshot.
"""
import argparse
import json
from pathlib import Path
import sys
import tarfile

PROJECT = "hutxsqzplyuqgnghsrcs"
LIMIT = 100000


def compare(archive_path, db_rows_path):
    with tarfile.open(archive_path, "r:") as archive:
        members = archive.getmembers()
        if not members or members[0].name != "manifest.json":
            raise ValueError("manifest missing or misplaced")
        head = members[0]
        if not head.isfile() or head.size > 20 * 1024 * 1024:
            raise ValueError("manifest invalid")
        source = archive.extractfile(head)
        if source is None:
            raise ValueError("manifest unavailable")
        manifest = json.load(source)
    if manifest.get("format") != "bonds-storage-v1" or manifest.get("project") != PROJECT:
        raise ValueError("wrong archive format or project")
    objects = manifest.get("objects")
    buckets = manifest.get("buckets")
    if not isinstance(objects, list) or not isinstance(buckets, list):
        raise ValueError("invalid archive metadata")
    if len(objects) > LIMIT or len(buckets) != len(set(buckets)):
        raise ValueError("invalid archive counts")
    rows_path = Path(db_rows_path)
    if rows_path.stat().st_size > 40 * 1024 * 1024:
        raise ValueError("isolated database inventory too large")
    rows = json.loads(rows_path.read_text(encoding="utf-8"))
    if not isinstance(rows, dict) or rows.get("project") != PROJECT:
        raise ValueError("isolated DB inventory missing project identity")
    db_buckets, db_objects = rows.get("buckets"), rows.get("objects")
    if not isinstance(db_buckets, list) or not isinstance(db_objects, list):
        raise ValueError("invalid isolated DB inventory")
    if len(db_objects) > LIMIT:
        raise ValueError("DB object count exceeds safety limit")
    if sorted(buckets) != sorted(db_buckets):
        raise ValueError("Storage bucket mismatch")

    def normalized(items, bucket_key, path_key):
        values = {}
        for item in items:
            if not isinstance(item, dict):
                raise ValueError("invalid inventory row")
            bucket, path = item.get(bucket_key), item.get(path_key)
            identity = (bucket, path)
            if not isinstance(bucket, str) or not isinstance(path, str):
                raise ValueError("invalid bucket/path")
            if identity in values:
                raise ValueError("duplicate storage object identity")
            size = item.get("size")
            if type(size) is not int or size < 0:
                raise ValueError("invalid object size")
            obj_id = item.get("id")
            if not isinstance(obj_id, str) or not obj_id:
                raise ValueError("invalid object ID")
            values[identity] = (obj_id, size)
        return values

    from_archive = normalized(objects, "bucket", "path")
    from_db = normalized(db_objects, "bucket_id", "name")
    if from_archive != from_db:
        missing = len(from_db.keys() - from_archive.keys())
        extra = len(from_archive.keys() - from_db.keys())
        wrong = sum(from_archive[k] != from_db[k]
                    for k in from_archive.keys() & from_db.keys())
        raise ValueError("DB/storage mismatch: missing=%d extra=%d differing=%d" %
                         (missing, extra, wrong))
    return {"status": "PASS", "buckets": len(buckets), "objects": len(objects)}


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--archive", type=Path, required=True)
    parser.add_argument("--isolated-db-inventory", type=Path, required=True)
    args = parser.parse_args()
    try:
        print(json.dumps(compare(args.archive, args.isolated_db_inventory),
                         sort_keys=True))
    except (OSError, ValueError, KeyError, TypeError, tarfile.TarError,
            json.JSONDecodeError) as exc:
        print("STATUS: FAIL - STORAGE_DB_ALIGNMENT (" +
              type(exc).__name__ + ")", file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main()
