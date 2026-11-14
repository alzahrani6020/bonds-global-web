#!/usr/bin/env python3
"""Independent, read-only correspondence PDF fidelity gate.

Requires only Python standard library and Poppler (pdfinfo, pdftoppm, pdftotext).
Does NOT modify PDFs, touch a database, issue documents, or change official records.
Output status is FAIL if a known discrepancy exists; UNKNOWN if required evidence
cannot be obtained; PASS only when all required comparisons are verified.
"""
import argparse
import hashlib
import json
import re
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path

MAX_PDF_BYTES = 30 * 1024 * 1024
MAX_PAGES = 50
DPI = 96
CHANNEL_TOLERANCE = 16
MAX_DIFF_RATIO = 0.001

def sha256(path):
    h = hashlib.sha256()
    with open(path, "rb") as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b""):
            h.update(chunk)
    return h.hexdigest()

def result(status, **details):
    return {"status": status, **details}

def run_tool(command, timeout=40):
    return subprocess.run(command, check=True, stdout=subprocess.PIPE,
                          stderr=subprocess.PIPE, timeout=timeout).stdout

def pdf_page_count(path):
    out = run_tool(["pdfinfo", str(path)], timeout=12).decode("utf-8", "replace")
    m = re.search(r"^Pages:\s*(\d+)\s*$", out, re.M)
    if not m:
        raise ValueError("pdfinfo did not provide page count")
    n = int(m.group(1))
    if n < 1 or n > MAX_PAGES:
        raise ValueError("PDF page count outside safety bounds")
    return n

def read_ppm(path):
    # P6 binary PPM, consumed without image libraries or OCR.
    data = Path(path).read_bytes()
    i = 0
    tokens = []
    while len(tokens) < 4:
        while i < len(data) and data[i] in b" \t\r\n":
            i += 1
        if i < len(data) and data[i] == 35:
            while i < len(data) and data[i] not in b"\r\n":
                i += 1
            continue
        start = i
        while i < len(data) and data[i] not in b" \t\r\n":
            i += 1
        if start == i:
            raise ValueError("invalid PPM header")
        tokens.append(data[start:i])
    if tokens[0] != b"P6" or tokens[3] != b"255":
        raise ValueError("expected binary P6 PPM with maxval 255")
    width, height = int(tokens[1]), int(tokens[2])
    if width < 1 or height < 1 or width * height > 20_000_000:
        raise ValueError("invalid PPM dimensions")
    if data[i:i+2] == b"\r\n":
        i += 2
    elif data[i:i+1] in (b" ", b"\t", b"\r", b"\n"):
        i += 1
    else:
        raise ValueError("PPM missing header delimiter")
    pixels = data[i:]
    if len(pixels) != width * height * 3:
        raise ValueError("PPM pixel count mismatch")
    return width, height, pixels

def compare_rgb(a, b, tolerance=CHANNEL_TOLERANCE):
    aw, ah, ap = a
    bw, bh, bp = b
    if (aw, ah) != (bw, bh):
        return result("FAIL", reason="rendered_dimensions_differ",
                      reference_dimensions=[aw, ah], candidate_dimensions=[bw, bh])
    different = 0
    for i in range(0, len(ap), 3):
        if max(abs(ap[i] - bp[i]), abs(ap[i+1] - bp[i+1]),
               abs(ap[i+2] - bp[i+2])) > tolerance:
            different += 1
    fraction = different / (aw * ah)
    return result("PASS" if fraction <= MAX_DIFF_RATIO else "FAIL",
                  differing_pixels=different, total_pixels=aw * ah,
                  differing_ratio=round(fraction, 7),
                  max_allowed_ratio=MAX_DIFF_RATIO, channel_tolerance=tolerance)

def rasterize(pdf, page, prefix):
    prefix = Path(prefix)
    run_tool(["pdftoppm", "-f", str(page), "-l", str(page),
              "-singlefile", "-r", str(DPI), "-ppm", str(pdf),
              str(prefix)], timeout=45)
    return read_ppm(str(prefix) + ".ppm")

def extracted_text(path):
    text = run_tool(["pdftotext", "-layout", "-enc", "UTF-8",
                     str(path), "-"], timeout=25).decode("utf-8", "replace")
    # Normalize space only, do not reorder Arabic words or bidi controls.
    return re.sub(r"\s+", " ", text).strip()

def aggregate(checks):
    statuses = [v["status"] for v in checks.values()]
    if "FAIL" in statuses:
        return "FAIL"
    if "UNKNOWN" in statuses or not statuses:
        return "UNKNOWN"
    return "PASS"

def compare(reference, candidate, logical_pages=None, expected_sha=None):
    checks = {}
    report = {
        "reference": Path(reference).name,
        "candidate": Path(candidate).name,
        "engine": "correspondence-fidelity-v1",
        "checks": checks
    }
    for file in (reference, candidate):
        p = Path(file)
        if not p.is_file() or p.stat().st_size < 5 or p.stat().st_size > MAX_PDF_BYTES:
            checks["input"] = result("UNKNOWN", reason="missing_or_oversized_PDF")
            report["status"] = "UNKNOWN"
            return report
        if p.open("rb").read(5) != b"%PDF-":
            checks["input"] = result("UNKNOWN", reason="not_a_PDF")
            report["status"] = "UNKNOWN"
            return report
    try:
        a_hash, b_hash = sha256(reference), sha256(candidate)
        checks["byte_integrity"] = result("PASS" if a_hash == b_hash else "FAIL",
                                          reference_sha256=a_hash, candidate_sha256=b_hash)
        if expected_sha:
            checks["archive_integrity"] = result(
                "PASS" if b_hash.lower() == expected_sha.lower() else "FAIL",
                expected_sha256=expected_sha.lower(), candidate_sha256=b_hash)
        a_count, b_count = pdf_page_count(reference), pdf_page_count(candidate)
        checks["page_count"] = result("PASS" if a_count == b_count else "FAIL",
                                      reference=a_count, candidate=b_count)
        if logical_pages is not None:
            checks["logical_to_physical_pages"] = result(
                "PASS" if logical_pages == b_count else "FAIL",
                saved_logical_pages=logical_pages, physical_pdf_pages=b_count)
        try:
            a_text, b_text = extracted_text(reference), extracted_text(candidate)
            if a_hash == b_hash:
                checks["content_text"] = result("PASS", reason="byte_identical")
            elif not a_text or not b_text:
                checks["content_text"] = result("UNKNOWN",
                                               reason="one_or_both_PDFs_have_no_extractable_text")
            else:
                checks["content_text"] = result("PASS" if a_text == b_text else "FAIL",
                                               reference_length=len(a_text),
                                               candidate_length=len(b_text))
        except (OSError, subprocess.SubprocessError, UnicodeError) as exc:
            checks["content_text"] = result("UNKNOWN", reason=type(exc).__name__)
        pages = []
        with tempfile.TemporaryDirectory(prefix="bonds-pdf-fidelity-") as tmp:
            for n in range(1, min(a_count, b_count) + 1):
                try:
                    left = rasterize(reference, n, Path(tmp) / ("reference-" + str(n)))
                    right = rasterize(candidate, n, Path(tmp) / ("candidate-" + str(n)))
                    pages.append({"page": n, **compare_rgb(left, right)})
                except (OSError, ValueError, subprocess.SubprocessError) as exc:
                    pages.append({"page": n, **result("UNKNOWN", reason=type(exc).__name__)})
        checks["visual_pages"] = result(
            aggregate({str(x["page"]): x for x in pages}), pages=pages)
        # Page-number labels, RTL and stamp semantics cannot be reliably proved
        # for raster-only PDFs without a source-stage geometry trace.
        checks["rtl_geometry"] = result("UNKNOWN", reason="source_and_canvas_geometry_not_supplied")
        checks["pagination_labels"] = result("UNKNOWN", reason="page_label_geometry_not_supplied")
        report["status"] = aggregate(checks)
    except (OSError, ValueError, subprocess.SubprocessError) as exc:
        checks["execution"] = result("UNKNOWN", reason=type(exc).__name__)
        report["status"] = aggregate(checks)
    return report

def main(argv=None):
    p = argparse.ArgumentParser(description="Read-only official PDF comparison; no production mutations")
    p.add_argument("--reference", required=True)
    p.add_argument("--candidate", required=True)
    p.add_argument("--logical-pages", type=int)
    p.add_argument("--expected-sha", help="Expected archived SHA256 for candidate PDF")
    p.add_argument("--report", help="Write JSON report, no PDF content included")
    args = p.parse_args(argv)
    if args.expected_sha and not re.fullmatch(r"[a-fA-F0-9]{64}", args.expected_sha):
        p.error("--expected-sha must contain exactly 64 hexadecimal characters")
    if args.logical_pages is not None and not (1 <= args.logical_pages <= MAX_PAGES):
        p.error("--logical-pages outside allowed range")
    report = compare(args.reference, args.candidate, args.logical_pages, args.expected_sha)
    output = json.dumps(report, ensure_ascii=False, indent=2)
    print(output)
    if args.report:
        Path(args.report).write_text(output + "\n", encoding="utf-8")
    return {"PASS": 0, "FAIL": 1, "UNKNOWN": 2}[report["status"]]

if __name__ == "__main__":
    sys.exit(main())
