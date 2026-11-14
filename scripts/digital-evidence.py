#!/usr/bin/env python3
"""Read-only multi-format evidence inspection and comparison.

This tool verifies bytes and (for supported OOXML containers) package parts.
It does not detect AI generation, forgery, signer identity or legal authenticity.
No files are modified, no external requests, no scripts or macros are run.
"""
import argparse
import hashlib
import json
import os
import struct
import sys
import zipfile
from pathlib import Path

MAX_BYTES = 128 * 1024 * 1024
MAX_ZIP_ENTRIES = 5000
MAX_UNCOMPRESSED = 256 * 1024 * 1024
MAX_PART_BYTES = 32 * 1024 * 1024

def digest(data):
    return hashlib.sha256(data).hexdigest()

def file_digest(path):
    h = hashlib.sha256()
    with open(path, "rb") as stream:
        for chunk in iter(lambda: stream.read(1048576), b""):
            h.update(chunk)
    return h.hexdigest()

def outcome(status, **fields):
    return {"status": status, **fields}

def identify(header, filename):
    if header.startswith(b"%PDF-"):
        return "pdf"
    if header.startswith(b"\x89PNG\r\n\x1a\n"):
        return "png"
    if header.startswith(b"\xff\xd8\xff"):
        return "jpeg"
    if header.startswith((b"GIF87a", b"GIF89a")):
        return "gif"
    if header[:4] == b"RIFF" and header[8:12] == b"WAVE":
        return "wav"
    if len(header) >= 12 and header[4:8] == b"ftyp":
        return "iso-bmff"
    if header.startswith(b"PK\x03\x04"):
        return "zip-package"
    if header.startswith(b"ID3") or header.startswith(b"\xff\xfb"):
        return "mp3"
    if header.startswith(b"BM"):
        return "bmp"
    if header.startswith((b"{\\rtf",)):
        return "rtf"
    if header.startswith(b"\xd0\xcf\x11\xe0\xa1\xb1\x1a\xe1"):
        return "legacy-ole"
    # Text must actually decode; extension alone is never proof of format.
    if b"\x00" not in header:
        try:
            header.decode("utf-8")
            return "utf8-text"
        except UnicodeError:
            pass
    return "unknown"

def ooxml_manifest(path):
    parts = {}
    total = 0
    with zipfile.ZipFile(path) as archive:
        entries = archive.infolist()
        if not entries or len(entries) > MAX_ZIP_ENTRIES:
            raise ValueError("ZIP entry limit exceeded")
        names = set()
        for info in entries:
            name = info.filename
            # Detect path traversal and ambiguous duplicate entries, do not extract.
            segments = name.replace("\\", "/").split("/")
            if not name or name.startswith("/") or ".." in segments or name in names:
                raise ValueError("Unsafe or duplicate ZIP entry")
            names.add(name)
            if info.flag_bits & 1:
                raise ValueError("Encrypted ZIP package is not inspectable")
            if info.file_size > MAX_PART_BYTES:
                raise ValueError("OOXML part exceeds safety limit")
            total += info.file_size
            if total > MAX_UNCOMPRESSED:
                raise ValueError("OOXML uncompressed size limit exceeded")
        if "[Content_Types].xml" not in names:
            raise ValueError("Not an OOXML package")
        if "word/document.xml" in names:
            kind = "docx"
            meaningful = lambda n: n.startswith("word/") and not n.endswith("/")
        elif "xl/workbook.xml" in names:
            kind = "xlsx"
            meaningful = lambda n: n.startswith("xl/") and not n.endswith("/")
        elif "ppt/presentation.xml" in names:
            kind = "pptx"
            meaningful = lambda n: n.startswith("ppt/") and not n.endswith("/")
        else:
            raise ValueError("Unsupported ZIP package format")
        # Macro-enabled packages are deliberately not interpreted as safe OOXML.
        if any("vbaProject" in n or n.lower().endswith((".bin", ".vba")) for n in names):
            raise ValueError("Active content detected; manual security review required")
        for info in entries:
            if meaningful(info.filename):
                with archive.open(info) as stream:
                    data = stream.read(MAX_PART_BYTES + 1)
                if len(data) != info.file_size:
                    raise ValueError("OOXML part size mismatch")
                parts[info.filename] = digest(data)
    return kind, parts

def inspect(path):
    path = Path(path)
    item = {"name": path.name, "status": "UNKNOWN", "format": "unknown"}
    try:
        if not path.is_file() or path.is_symlink():
            return {**item, "reason": "not_a_regular_file"}
        size = path.stat().st_size
        if size < 5 or size > MAX_BYTES:
            return {**item, "reason": "file_size_outside_limits", "size_bytes": size}
        with path.open("rb") as stream:
            header = stream.read(128)
        kind = identify(header, path.name)
        item.update({"size_bytes": size, "sha256": file_digest(path), "format": kind})
        if kind == "zip-package":
            kind, parts = ooxml_manifest(path)
            item["format"] = kind
            item["package_parts"] = parts
            item["status"] = "PASS"
        elif kind in ("pdf", "png", "jpeg", "gif", "wav", "iso-bmff",
                      "mp3", "bmp", "rtf", "legacy-ole", "utf8-text"):
            item["status"] = "PASS"
            if kind == "legacy-ole":
                item["reason"] = "legacy_office_format_requires_specialized_parser"
            if kind == "iso-bmff":
                item["reason"] = "container_signature_only_not_video_authenticity"
        else:
            item["reason"] = "unrecognized_file_signature"
    except (OSError, ValueError, EOFError, zipfile.BadZipFile, RuntimeError) as error:
        item["status"] = "UNKNOWN"
        item["reason"] = type(error).__name__
    return item

def compare(reference, candidate):
    left, right = inspect(reference), inspect(candidate)
    checks = {}
    report = {"engine": "bonds-evidence-v1", "reference": left["name"],
              "candidate": right["name"], "checks": checks}
    if left["status"] != "PASS" or right["status"] != "PASS":
        checks["inspection"] = outcome("UNKNOWN", reason="unsupported_or_unreadable_input")
        report["status"] = "UNKNOWN"
        return report
    checks["format"] = outcome("PASS" if left["format"] == right["format"] else "FAIL",
                               reference=left["format"], candidate=right["format"])
    checks["byte_integrity"] = outcome("PASS" if left["sha256"] == right["sha256"] else "FAIL",
                                       reference_sha256=left["sha256"],
                                       candidate_sha256=right["sha256"])
    if left["format"] == right["format"] and "package_parts" in left and "package_parts" in right:
        lp, rp = left["package_parts"], right["package_parts"]
        modified = sorted(k for k in lp.keys() & rp.keys() if lp[k] != rp[k])
        added = sorted(rp.keys() - lp.keys())
        removed = sorted(lp.keys() - rp.keys())
        checks["office_package_parts"] = outcome(
            "PASS" if not (modified or added or removed) else "FAIL",
            modified_parts=modified, added_parts=added, removed_parts=removed)
    else:
        checks["office_package_parts"] = outcome("UNKNOWN", reason="non_OOXML_or_mixed_format")
    checks["semantic_equivalence"] = outcome(
        "UNKNOWN", reason="format_specific_text_layout_or_media_semantics_not_verified")
    checks["ai_origin"] = outcome(
        "UNKNOWN", reason="AI_generation_cannot_be_proven_by_file_hash_or_extension")
    checks["authenticity"] = outcome(
        "UNKNOWN", reason="no_trusted_signature_or_provenance_validation")
    checks["producer_identity"] = outcome(
        "UNKNOWN", reason="authoring_application_not_cryptographically_verified")
    statuses = [c["status"] for k, c in checks.items()
                if k in ("format", "byte_integrity", "office_package_parts")]
    report["status"] = "FAIL" if "FAIL" in statuses else "UNKNOWN"
    return report

def main(argv=None):
    ap = argparse.ArgumentParser(description="Read-only multi-format evidence inspection")
    ap.add_argument("--reference", required=True)
    ap.add_argument("--candidate", required=True)
    ap.add_argument("--report")
    args = ap.parse_args(argv)
    result = compare(args.reference, args.candidate)
    output = json.dumps(result, ensure_ascii=False, indent=2)
    print(output)
    if args.report:
        Path(args.report).write_text(output + "\n", encoding="utf-8")
    return {"PASS": 0, "FAIL": 1, "UNKNOWN": 2}[result["status"]]

if __name__ == "__main__":
    sys.exit(main())
