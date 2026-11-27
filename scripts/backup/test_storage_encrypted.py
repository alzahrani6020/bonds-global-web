"""Offline, synthetic acceptance tests. Never contact production."""
import hashlib
import io
import json
from pathlib import Path
import tarfile
import tempfile
import unittest
from unittest.mock import patch
import sys

sys.path.insert(0, str(Path(__file__).parent))
import export_storage_encrypted as export
import verify_storage_restored as verifier


def tar_with_objects(items, contents):
    manifest = {"format": "bonds-storage-v1", "objects": []}
    stream = io.BytesIO()
    for index, ((bucket, path), raw) in enumerate(zip(items, contents)):
        manifest["objects"].append({
            "bucket": bucket, "path": path, "size": len(raw),
            "sha256": hashlib.sha256(raw).hexdigest(),
            "blob": "blobs/%08d" % index
        })
    with tarfile.open(fileobj=stream, mode="w") as tar:
        data = json.dumps(manifest).encode()
        hdr = tarfile.TarInfo("manifest.json")
        hdr.size = len(data)
        tar.addfile(hdr, io.BytesIO(data))
        for i, raw in enumerate(contents):
            hdr = tarfile.TarInfo("blobs/%08d" % i)
            hdr.size = len(raw)
            tar.addfile(hdr, io.BytesIO(raw))
    return stream.getvalue()


class ArchiveVerificationTests(unittest.TestCase):
    def test_valid_objects_and_nested_names(self):
        with tempfile.TemporaryDirectory() as tmp:
            path = Path(tmp) / "archive.tar"
            path.write_bytes(tar_with_objects(
                [("client-documents", "private/test.pdf"),
                 ("avatars", "nested/file.png")],
                [b"document", b"avatar"]))
            with patch("builtins.print"):
                verifier.verify(path)

    def test_tampered_blob_is_rejected(self):
        contents = [b"secret-A"]
        data = tar_with_objects([("avatars", "a.png")], contents)
        with tempfile.TemporaryDirectory() as tmp:
            path = Path(tmp) / "bad.tar"
            # Tamper with the original bytes inside tar without changing manifest.
            path.write_bytes(data.replace(b"secret-A", b"secret-B"))
            with self.assertRaises(ValueError):
                verifier.verify(path)

    def test_extra_member_rejected(self):
        with tempfile.TemporaryDirectory() as tmp:
            path = Path(tmp) / "bad.tar"
            path.write_bytes(tar_with_objects([("avatars", "a")], [b"A"]))
            with tarfile.open(path, "a") as archive:
                x = tarfile.TarInfo("../escape.txt")
                x.size = 1
                archive.addfile(x, io.BytesIO(b"X"))
            with self.assertRaises(ValueError):
                verifier.verify(path)


class StorageInventoryTests(unittest.TestCase):
    def test_discover_all_buckets_including_empty(self):
        payload = [{"id": "avatars"}, {"id": "new-empty"}, {"id": "documents"}]
        with patch.object(export, "urlopen") as open_url:
            response = open_url.return_value.__enter__.return_value
            response.read.return_value = json.dumps(payload).encode()
            self.assertEqual(export.list_buckets("https://example.invalid", "fake"),
                             ["avatars", "documents", "new-empty"])
        with patch.object(export, "inventory_bucket", side_effect=[
                [], [{"bucket": "documents", "path": "a", "id": "1",
                      "size": 1, "updated_at": None}], []]) as bucket_inventory:
            found = export.inventory("https://example.invalid", "fake",
                                     ["avatars", "documents", "new-empty"])
            self.assertEqual(len(found), 1)
            self.assertEqual(bucket_inventory.call_count, 3)

    def test_missing_bucket_listing_rejected(self):
        with patch.object(export, "urlopen") as open_url:
            response = open_url.return_value.__enter__.return_value
            response.read.return_value = b"[]"
            with self.assertRaises(RuntimeError):
                export.list_buckets("https://example.invalid", "fake")

    def test_nested_pagination(self):
        def list_api(url, key, payload):
            prefix, offset = payload["prefix"], payload["offset"]
            if prefix == "" and offset == 0:
                return [{"name": "child", "id": None},
                        {"name": "root.txt", "id": "1", "metadata": {"size": 1}}]
            if prefix == "child/" and offset == 0:
                return [{"name": "nested.txt", "id": "2", "metadata": {"size": "2"}}]
            return []
        with patch.object(export, "request_json", side_effect=list_api):
            result = export.inventory_bucket("https://example.invalid", "fake", "avatars")
        self.assertEqual([x["path"] for x in result], ["child/nested.txt", "root.txt"])

    def test_missing_size_fails_closed(self):
        with patch.object(export, "request_json", return_value=[
            {"name": "unsafe", "id": "1", "metadata": {}}
        ]):
            with self.assertRaises(RuntimeError):
                export.inventory_bucket("https://example.invalid", "fake", "avatars")

    def test_duplicate_path_fails_closed(self):
        with patch.object(export, "request_json", side_effect=[
            [{"name": "same", "id": "1", "metadata": {"size": 1}},
             {"name": "same", "id": "2", "metadata": {"size": 1}}]
        ]):
            with self.assertRaises(RuntimeError):
                export.inventory_bucket("https://example.invalid", "fake", "avatars")

    def test_existing_target_rejected(self):
        with tempfile.TemporaryDirectory() as tmp:
            dest = Path(tmp) / "storage.age"
            dest.write_bytes(b"old")
            with self.assertRaises(RuntimeError):
                export.produce("https://example.invalid", "fake", "age1abc", dest, "123")
            self.assertEqual(dest.read_bytes(), b"old")

    def test_inventory_change_rejected_before_encrypting(self):
        originals = [{"bucket": "avatars", "path": "first", "id": "1",
                      "size": 1, "updated_at": None}]
        changed = [{"bucket": "avatars", "path": "first", "id": "2",
                    "size": 1, "updated_at": None}]
        with tempfile.TemporaryDirectory() as tmp:
            dest = Path(tmp) / "output.age"
            with patch.object(export, "list_buckets", return_value=["avatars"]):
                with patch.object(export, "inventory", side_effect=[originals, changed]):
                    with patch.object(export, "download", return_value=(1, hashlib.sha256(b"a").hexdigest())):
                        with self.assertRaises(RuntimeError):
                            export.produce("https://example.invalid", "fake",
                                       "age1recipient", dest, "123")
            self.assertFalse(dest.exists())


if __name__ == "__main__":
    unittest.main()
