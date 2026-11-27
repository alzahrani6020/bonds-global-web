"""Offline regression tests for database/blob consistency gate."""
import io
import hashlib
import json
from pathlib import Path
import tarfile
import tempfile
import unittest
import sys

sys.path.insert(0, str(Path(__file__).parent))
import check_storage_db_alignment as alignment

PROJECT = "hutxsqzplyuqgnghsrcs"


def archive(path, items, buckets=None):
    if buckets is None:
        buckets = ["avatars", "empty"]
    objects = []
    for i, item in enumerate(items):
        body = bytes([65 + i % 25]) * item["size"]
        objects.append({**item, "blob": "blobs/%08d" % i,
                        "sha256": hashlib.sha256(body).hexdigest()})
    manifest = {"format": "bonds-storage-v1", "project": PROJECT,
                "run_id": "123", "buckets": buckets, "objects": objects}
    with tarfile.open(path, "w") as out:
        data = json.dumps(manifest).encode()
        member = tarfile.TarInfo("manifest.json")
        member.size = len(data)
        out.addfile(member, io.BytesIO(data))
        for i, item in enumerate(items):
            body = bytes([65 + i % 25]) * item["size"]
            member = tarfile.TarInfo("blobs/%08d" % i)
            member.size = len(body)
            out.addfile(member, io.BytesIO(body))


def db_inventory(path, items, buckets=None):
    path.write_text(json.dumps({
        "project": PROJECT, "buckets": buckets or ["avatars", "empty"],
        "objects": items
    }), encoding="utf-8")


class AlignmentGateTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.tar = Path(self.tmp.name) / "backup.tar"
        self.db = Path(self.tmp.name) / "db.json"
        self.blob = [{"bucket": "avatars", "path": "nested/a.png",
                      "id": "obj-1", "size": 10}]
        self.row = [{"bucket_id": "avatars", "name": "nested/a.png",
                     "id": "obj-1", "size": 10}]

    def test_matching_metadata_passes(self):
        archive(self.tar, self.blob)
        db_inventory(self.db, self.row)
        self.assertEqual(alignment.compare(self.tar, self.db),
                         {"status": "PASS", "buckets": 2, "objects": 1})

    def test_missing_object_fails(self):
        archive(self.tar, self.blob)
        db_inventory(self.db, [])
        with self.assertRaises(ValueError):
            alignment.compare(self.tar, self.db)

    def test_extra_object_fails(self):
        archive(self.tar, [])
        db_inventory(self.db, self.row)
        with self.assertRaises(ValueError):
            alignment.compare(self.tar, self.db)

    def test_matching_metadata_but_tampered_bytes_rejected(self):
        archive(self.tar, self.blob)
        db_inventory(self.db, self.row)
        data = self.tar.read_bytes()
        self.assertIn(b"AAAAAAAAAA", data)
        self.tar.write_bytes(data.replace(b"AAAAAAAAAA", b"BBBBBBBBBB"))
        with self.assertRaises(ValueError):
            alignment.compare(self.tar, self.db)

    def test_wrong_id_fails(self):
        archive(self.tar, self.blob)
        db_inventory(self.db, [{**self.row[0], "id": "different"}])
        with self.assertRaises(ValueError):
            alignment.compare(self.tar, self.db)

    def test_wrong_size_fails(self):
        archive(self.tar, self.blob)
        db_inventory(self.db, [{**self.row[0], "size": 11}])
        with self.assertRaises(ValueError):
            alignment.compare(self.tar, self.db)

    def test_missing_bucket_fails(self):
        archive(self.tar, self.blob)
        db_inventory(self.db, self.row, buckets=["avatars"])
        with self.assertRaises(ValueError):
            alignment.compare(self.tar, self.db)

    def test_wrong_project_fails(self):
        archive(self.tar, self.blob)
        self.db.write_text(json.dumps({
            "project": "different", "buckets": ["avatars", "empty"],
            "objects": self.row
        }))
        with self.assertRaises(ValueError):
            alignment.compare(self.tar, self.db)

    def test_duplicate_row_fails(self):
        archive(self.tar, self.blob)
        db_inventory(self.db, self.row * 2)
        with self.assertRaises(ValueError):
            alignment.compare(self.tar, self.db)


if __name__ == "__main__":
    unittest.main()
