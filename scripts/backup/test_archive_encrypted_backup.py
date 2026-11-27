import importlib.util
import tempfile
import unittest
from pathlib import Path
from unittest import mock

spec = importlib.util.spec_from_file_location('archiver', Path(__file__).with_name('archive_encrypted_backup.py'))
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)

class ArchiveTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.root = Path(self.tmp.name)
        self.src_dir = self.root / 'src'
        self.out_dir = self.root / 'offline'
        self.src_dir.mkdir()
        self.out_dir.mkdir()
        self.source = self.src_dir / 'production-45814509069.dump.age'
        self.source.write_bytes(b'age-encryption.org/v1\n' + b'x' * 2048)
    def tearDown(self):
        self.tmp.cleanup()
    def test_copy_integrity_and_manifest(self):
        result = module.archive(self.source, self.out_dir)
        self.assertEqual(result['status'], 'COPY_SHA256_PASS')
        self.assertEqual(self.source.read_bytes(), (self.out_dir/self.source.name).read_bytes())
        self.assertTrue((self.out_dir/(self.source.name+'.sha256.json')).exists())
    def test_no_overwrite(self):
        module.archive(self.source, self.out_dir)
        with self.assertRaises(FileExistsError):
            module.archive(self.source, self.out_dir)
    def test_empty_rejected(self):
        self.source.write_bytes(b'')
        with self.assertRaises(ValueError):
            module.archive(self.source, self.out_dir)
    def test_source_name_rejected(self):
        other = self.src_dir / 'production.dump'
        other.write_bytes(b'unsafe')
        with self.assertRaises(ValueError):
            module.archive(other, self.out_dir)
    def test_no_copy_to_source_dir(self):
        with self.assertRaises(ValueError):
            module.archive(self.source, self.src_dir)
    def test_interrupted_copy_removed(self):
        with mock.patch.object(module.shutil, 'copyfileobj', side_effect=OSError('disk full')):
            with self.assertRaises(OSError):
                module.archive(self.source, self.out_dir)
        self.assertFalse((self.out_dir/self.source.name).exists())
        self.assertFalse((self.out_dir/(self.source.name+'.sha256.json')).exists())
    def test_symlink_rejected(self):
        link = self.src_dir / 'production-45814509070.dump.age'
        try:
            link.symlink_to(self.source)
        except OSError:
            self.skipTest('symlinks unavailable')
        with self.assertRaises(ValueError):
            module.archive(link, self.out_dir)

if __name__ == '__main__':
    unittest.main()
