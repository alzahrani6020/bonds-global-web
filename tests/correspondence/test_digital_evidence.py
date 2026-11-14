"""Tests for format-independent evidence comparison. No live service or real user data."""
import importlib.util
import tempfile
import unittest
import zipfile
from pathlib import Path

ENGINE = Path(__file__).resolve().parents[2] / "scripts" / "digital-evidence.py"
spec = importlib.util.spec_from_file_location("digital_evidence", ENGINE)
evidence = importlib.util.module_from_spec(spec)
spec.loader.exec_module(evidence)

class EvidenceTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.base = Path(self.tmp.name)

    def write(self, name, data):
        path = self.base / name
        path.write_bytes(data)
        return path

    def office(self, name, entry="word/document.xml", content=b"<w:document/>"):
        path = self.base / name
        with zipfile.ZipFile(path, "w") as archive:
            archive.writestr("[Content_Types].xml", b"<Types/>")
            archive.writestr(entry, content)
        return path

    def test_identical_pdf_bytes_have_matching_hash_not_false_provenance(self):
        p = self.write("one.pdf", b"%PDF-1.4\nminimal test bytes")
        result = evidence.compare(p, p)
        self.assertEqual(result["checks"]["byte_integrity"]["status"], "PASS")
        self.assertEqual(result["checks"]["ai_origin"]["status"], "UNKNOWN")
        self.assertEqual(result["status"], "UNKNOWN")

    def test_modified_office_part_is_detected(self):
        original = self.office("original.docx")
        changed = self.office("changed.docx", content=b"<w:document>edited</w:document>")
        report = evidence.compare(original, changed)
        self.assertEqual(report["status"], "FAIL")
        self.assertIn("word/document.xml", report["checks"]["office_package_parts"]["modified_parts"])

    def test_xlsx_and_pptx_identified_by_internal_parts(self):
        xlsx = self.office("anything.bin", "xl/workbook.xml")
        pptx = self.office("another.bin", "ppt/presentation.xml")
        self.assertEqual(evidence.inspect(xlsx)["format"], "xlsx")
        self.assertEqual(evidence.inspect(pptx)["format"], "pptx")

    def test_missing_input_is_unknown(self):
        p = self.write("reference.pdf", b"%PDF-1.4\nfixture")
        report = evidence.compare(p, self.base / "missing.pdf")
        self.assertEqual(report["status"], "UNKNOWN")

    def test_mislabeled_extension_uses_real_signature(self):
        p = self.write("file.docx", b"\x89PNG\r\n\x1a\n" + b"\x00" * 50)
        self.assertEqual(evidence.inspect(p)["format"], "png")

    def test_untrusted_zip_traversal_is_unknown(self):
        p = self.base / "evil.docx"
        with zipfile.ZipFile(p, "w") as archive:
            archive.writestr("[Content_Types].xml", "<Types/>")
            archive.writestr("word/document.xml", "<doc/>")
            archive.writestr("../outside.xml", "<bad/>")
        self.assertEqual(evidence.inspect(p)["status"], "UNKNOWN")

    def test_same_content_different_office_container_is_not_byte_identical(self):
        a = self.office("a.docx")
        b = self.office("b.docx")
        report = evidence.compare(a, b)
        self.assertEqual(report["checks"]["office_package_parts"]["status"], "PASS")
        self.assertEqual(report["checks"]["byte_integrity"]["status"], "PASS")
        self.assertEqual(report["status"], "UNKNOWN")

    def test_unequal_media_bytes_not_claimed_forgery(self):
        a = self.write("a.jpg", b"\xff\xd8\xff" + b"ABCDEF")
        b = self.write("b.jpg", b"\xff\xd8\xff" + b"UVWXYZ")
        report = evidence.compare(a, b)
        self.assertEqual(report["checks"]["byte_integrity"]["status"], "FAIL")
        self.assertEqual(report["checks"]["authenticity"]["status"], "UNKNOWN")

if __name__ == "__main__":
    unittest.main()
