"""Run the SQL inventory gate against an actual disposable PostgreSQL server.

The CI-only connection is supplied as ISOLATED_TEST_DATABASE_URL. Never pass
production credentials or URLs. No writes occur outside the disposable DB.
"""
import hashlib
import io
import json
import os
from pathlib import Path
from unittest.mock import patch
import subprocess
import tarfile
import tempfile
import unittest

import check_storage_db_alignment as alignment
import export_storage_encrypted as storage_export
import verify_storage_restored as storage_verify

ROOT = Path(__file__).resolve().parents[2]
SQL = ROOT / "scripts/backup/export_isolated_storage_metadata.sql"
REF = "hutxsqzplyuqgnghsrcs"
OBJ_ID = "11111111-1111-4111-8111-111111111111"
DATA = b"disposable-isolated-postgres-storage"


def psql(url, *, query=None, script=None):
    cmd = ["psql", "-q", "-X", "-A", "-t", "-v", "ON_ERROR_STOP=1", url]
    if query is not None:
        cmd += ["-c", query]
    elif script is not None:
        cmd += ["-f", str(script)]
    result = subprocess.run(cmd, capture_output=True, text=True, timeout=30)
    return result


def build_archive(path, *, size=None):
    size = len(DATA) if size is None else size
    manifest = {
        "format": "bonds-storage-v1", "project": REF, "run_id": "123",
        "buckets": ["avatars", "empty-bucket"],
        "objects": [{"bucket": "avatars", "path": "private/sample.txt",
                     "id": OBJ_ID, "size": size,
                     "blob": "blobs/00000000",
                     "sha256": hashlib.sha256(DATA).hexdigest()}],
    }
    with tarfile.open(path, "w") as archive:
        raw = json.dumps(manifest).encode()
        member = tarfile.TarInfo("manifest.json")
        member.size = len(raw)
        archive.addfile(member, io.BytesIO(raw))
        member = tarfile.TarInfo("blobs/00000000")
        member.size = len(DATA)
        archive.addfile(member, io.BytesIO(DATA))


@unittest.skipUnless(os.environ.get("ISOLATED_TEST_DATABASE_URL") and
                     os.environ.get("RUN_DISPOSABLE_PG_INTEGRATION") == "1",
                     "requires explicitly opted-in disposable PostgreSQL")
class DisposablePostgreSQLIntegration(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.url = os.environ["ISOLATED_TEST_DATABASE_URL"]
        if not cls.url.startswith("postgresql://") and not cls.url.startswith("postgres://"):
            raise AssertionError("invalid disposable database connection")
        db = psql(cls.url, query="select current_database()")
        if db.returncode or db.stdout.strip() != "bonds_restore_gate":
            raise AssertionError("refuse to use non-isolated database")
        ddl = """
        CREATE SCHEMA IF NOT EXISTS storage;
        CREATE TABLE storage.buckets (id text PRIMARY KEY);
        CREATE TABLE storage.objects (
            id uuid PRIMARY KEY, bucket_id text, name text, metadata jsonb
        );
        INSERT INTO storage.buckets(id) VALUES ('avatars'),('empty-bucket');
        INSERT INTO storage.objects(id,bucket_id,name,metadata)
        VALUES ('11111111-1111-4111-8111-111111111111',
                'avatars','private/sample.txt',
                jsonb_build_object('size', %d));
        """ % len(DATA)
        result = psql(cls.url, query=ddl)
        if result.returncode:
            raise AssertionError("could not initialize disposable test schema")

    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.archive = Path(self.tmp.name) / "storage.tar"
        self.inventory = Path(self.tmp.name) / "inventory.json"
        build_archive(self.archive)
        out = psql(self.url, script=SQL)
        self.assertEqual(out.returncode, 0, "isolated SQL inventory export failed")
        self.inventory.write_text(out.stdout, encoding="utf-8")

    def test_real_postgres_inventory_matches_hash_verified_archive(self):
        result = alignment.compare(self.archive, self.inventory)
        self.assertEqual(result, {"status": "PASS", "buckets": 2, "objects": 1})

    def test_real_postgres_mismatch_rejected(self):
        build_archive(self.archive, size=len(DATA) + 1)
        with self.assertRaises(ValueError):
            alignment.compare(self.archive, self.inventory)

    def test_full_storage_age_roundtrip_matches_actual_isolated_postgresql(self):
        """One chained gate: mocked Storage HTTP -> real AGE -> files -> real PG."""
        identity = Path(self.tmp.name) / "age-identity.txt"
        subprocess.run(["age-keygen", "-o", str(identity)], check=True,
                       stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        recipient = next(line.split(": ", 1)[1] for line in identity.read_text().splitlines()
                         if line.startswith("# public key: age1"))
        ciphertext = Path(self.tmp.name) / "storage.tar.age"
        plaintext = Path(self.tmp.name) / "storage-decrypted.tar"
        restored = Path(self.tmp.name) / "restored"

        def fake_urlopen(req, timeout=None):
            url = req.full_url
            if "/storage/v1/bucket?" in url:
                return io.BytesIO(json.dumps([
                    {"id": "avatars"}, {"id": "empty-bucket"}]).encode())
            if "/storage/v1/object/list/" in url:
                prefix = json.loads(req.data.decode())["prefix"]
                if url.endswith("/avatars"):
                    if prefix == "":
                        payload = [{"name": "private", "id": None}]
                    elif prefix == "private/":
                        payload = [{"name": "sample.txt", "id": OBJ_ID,
                                    "metadata": {"size": len(DATA)}}]
                    else:
                        raise AssertionError("unexpected folder prefix")
                elif url.endswith("/empty-bucket"):
                    payload = []
                else:
                    raise AssertionError("unexpected bucket URL")
                return io.BytesIO(json.dumps(payload).encode())
            if "/storage/v1/object/authenticated/avatars/private/sample.txt" in url:
                return io.BytesIO(DATA)
            raise AssertionError("unknown mock Storage endpoint")

        with patch.object(storage_export, "urlopen", side_effect=fake_urlopen):
            storage_export.produce("https://mock.invalid", "synthetic-key",
                                   recipient, ciphertext, "1234")
        subprocess.run(["age", "-d", "-i", str(identity), "-o",
                        str(plaintext), str(ciphertext)], check=True,
                       stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        storage_verify.verify(plaintext, restored)
        self.assertEqual((restored / "avatars/private/sample.txt").read_bytes(), DATA)
        self.assertEqual(alignment.compare(plaintext, self.inventory),
                         {"status": "PASS", "buckets": 2, "objects": 1})

    def test_sql_export_refuses_other_database(self):
        wrong = self.url.rsplit("/", 1)[0] + "/postgres"
        result = psql(wrong, script=SQL)
        self.assertNotEqual(result.returncode, 0)
        self.assertNotIn('"objects"', result.stdout)


if __name__ == "__main__":
    unittest.main()
