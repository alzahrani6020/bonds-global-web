"""Regression tests for read-only PDF fidelity comparison.

Run: python3 -m unittest discover -s tests/correspondence -p 'test_*.py'
No production document, credentials, database, or network access needed.
"""
import importlib.util
import tempfile
import unittest
from pathlib import Path

ENGINE = Path(__file__).resolve().parents[2] / "scripts" / "correspondence-fidelity.py"
spec = importlib.util.spec_from_file_location("correspondence_fidelity", ENGINE)
fidelity = importlib.util.module_from_spec(spec)
spec.loader.exec_module(fidelity)


def fixture_pdf(path, message="Safe synthetic correspondence", page_count=1):
    """Generate minimal valid fixed-size PDF using only Python stdlib."""
    objects = []
    def obj(data):
        objects.append(data)
        return len(objects)
    catalog_id = obj(b"")
    pages_id = obj(b"")
    font_id = obj(b"<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>")
    page_ids = []
    safe_message = message.replace("\\", "\\\\").replace("(", "\\(").replace(")", "\\)")
    for index in range(page_count):
        content = ("BT /F1 16 Tf 50 760 Td (%s Page %d of %d) Tj ET" %
                   (safe_message, index + 1, page_count)).encode("ascii")
        stream_id = obj(b"<< /Length %d >>\nstream\n" % len(content) +
                        content + b"\nendstream")
        page_ids.append(obj(("<< /Type /Page /Parent %d 0 R /MediaBox [0 0 595 842] "
                             "/Resources << /Font << /F1 %d 0 R >> >> "
                             "/Contents %d 0 R >>") %
                             (pages_id, font_id, stream_id)).encode("ascii"))
    objects[catalog_id - 1] = ("<< /Type /Catalog /Pages %d 0 R >>" % pages_id).encode()
    objects[pages_id - 1] = ("<< /Type /Pages /Kids [%s] /Count %d >>" %
                            (" ".join("%d 0 R" % item for item in page_ids),
                             page_count)).encode()
    data = bytearray(b"%PDF-1.4\n")
    offsets = [0]
    for index, content in enumerate(objects, 1):
        offsets.append(len(data))
        data.extend(("%d 0 obj\n" % index).encode() + content + b"\nendobj\n")
    xref = len(data)
    data.extend(("xref\n0 %d\n0000000000 65535 f \n" % (len(objects) + 1)).encode())
    for offset in offsets[1:]:
        data.extend(("%010d 00000 n \n" % offset).encode())
    data.extend(("trailer\n<< /Size %d /Root %d 0 R >>\nstartxref\n%d\n%%%%EOF\n" %
                 (len(objects) + 1, catalog_id, xref)).encode())
    path.write_bytes(data)


@unittest.skipUnless(
    all(fidelity.shutil.which(binary) for binary in ("pdfinfo", "pdftoppm", "pdftotext")),
    "Poppler utilities not installed"
)
class FidelityTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.base = Path(self.temp.name)
        self.original = self.base / "original.pdf"
        fixture_pdf(self.original)

    def test_same_document_has_no_false_failures_but_unknown_visual_semantics(self):
        report = fidelity.compare(self.original, self.original)
        self.assertEqual(report["checks"]["byte_integrity"]["status"], "PASS")
        self.assertEqual(report["checks"]["page_count"]["status"], "PASS")
        self.assertEqual(report["checks"]["visual_pages"]["status"], "PASS")
        self.assertEqual(report["status"], "UNKNOWN")
        self.assertEqual(report["checks"]["rtl_geometry"]["status"], "UNKNOWN")

    def test_pixel_and_hash_difference_must_fail(self):
        changed = self.base / "changed.pdf"
        fixture_pdf(changed, message="Tampered correspondence")
        report = fidelity.compare(self.original, changed)
        self.assertEqual(report["status"], "FAIL")
        self.assertEqual(report["checks"]["byte_integrity"]["status"], "FAIL")
        self.assertEqual(report["checks"]["visual_pages"]["status"], "FAIL")

    def test_one_saved_page_two_physical_pages_is_fail(self):
        two = self.base / "two.pdf"
        fixture_pdf(two, page_count=2)
        report = fidelity.compare(two, two, logical_pages=1)
        self.assertEqual(report["status"], "FAIL")
        self.assertEqual(report["checks"]["logical_to_physical_pages"]["status"], "FAIL")

    def test_expected_sha_tampering_is_fail(self):
        report = fidelity.compare(self.original, self.original, expected_sha="0" * 64)
        self.assertEqual(report["status"], "FAIL")
        self.assertEqual(report["checks"]["archive_integrity"]["status"], "FAIL")

    def test_missing_input_is_unknown_not_pass(self):
        report = fidelity.compare(self.original, self.base / "missing.pdf")
        self.assertEqual(report["status"], "UNKNOWN")


if __name__ == "__main__":
    unittest.main()
