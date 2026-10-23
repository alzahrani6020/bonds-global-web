# Imported source snapshot for BONDS adaptation.
# Source: alzahrani6020/AFAQ-GIE@b1fec7fa400c57f32c2022a21cf74039379fc3cf:web_acquisition/content_extraction.py
# STAGING ONLY: not imported by BONDS runtime.

"""Multi-format content extraction for governed web acquisition.

Extraction is bounded and evidence-preserving. It does not treat parsed text as
verified truth; verification remains the responsibility of evidence/claim
gates.
"""

from __future__ import annotations

import csv
import io
import json
import re
from defusedxml import ElementTree as ET
from dataclasses import dataclass
from html import unescape
from typing import Any


@dataclass(frozen=True)
class ExtractedContent:
    format: str
    text: str
    structured: Any
    links: tuple[str, ...]
    metadata: dict[str, Any]
    truncated: bool
    warnings: tuple[str, ...]

    def as_dict(self) -> dict[str, Any]:
        return {
            "format": self.format,
            "text": self.text,
            "structured": self.structured,
            "links": list(self.links),
            "metadata": dict(self.metadata),
            "truncated": self.truncated,
            "warnings": list(self.warnings),
        }


def _bounded_text(value: str, max_chars: int) -> tuple[str, bool]:
    if len(value) <= max_chars:
        return value, False
    return value[:max_chars], True


def _extract_html(raw: str, max_chars: int) -> ExtractedContent:
    links = tuple(sorted(dict.fromkeys(re.findall(r'href=["\']([^"\']+)', raw, re.I))))
    no_script = re.sub(r"<script\b[^>]*>.*?</script>", " ", raw, flags=re.I | re.S)
    no_style = re.sub(r"<style\b[^>]*>.*?</style>", " ", no_script, flags=re.I | re.S)
    text = unescape(re.sub(r"<[^>]+>", " ", no_style))
    text = re.sub(r"\s+", " ", text).strip()
    text, truncated = _bounded_text(text, max_chars)
    return ExtractedContent(
        format="html",
        text=text,
        structured=None,
        links=links,
        metadata={},
        truncated=truncated,
        warnings=(),
    )


def _extract_json(raw: str, max_chars: int) -> ExtractedContent:
    warnings: list[str] = []
    try:
        data = json.loads(raw)
    except json.JSONDecodeError:
        text, truncated = _bounded_text(raw, max_chars)
        return ExtractedContent(
            format="json",
            text=text,
            structured=None,
            links=(),
            metadata={},
            truncated=truncated,
            warnings=("INVALID_JSON",),
        )
    pretty = json.dumps(data, ensure_ascii=False, sort_keys=True)
    text, truncated = _bounded_text(pretty, max_chars)
    links = tuple(sorted(dict.fromkeys(re.findall(r'https?://[^\s"<>]+', pretty))))
    return ExtractedContent(
        format="json",
        text=text,
        structured=data,
        links=links,
        metadata={"top_level_type": type(data).__name__},
        truncated=truncated,
        warnings=tuple(warnings),
    )


def _extract_xml(raw: str, max_chars: int) -> ExtractedContent:
    warnings: list[str] = []
    try:
        root = ET.fromstring(raw)
    except ET.ParseError:
        text, truncated = _bounded_text(raw, max_chars)
        return ExtractedContent(
            format="xml",
            text=text,
            structured=None,
            links=(),
            metadata={},
            truncated=truncated,
            warnings=("INVALID_XML",),
        )
    text_value = " ".join(part.strip() for part in root.itertext() if part and part.strip())
    text_value, truncated = _bounded_text(re.sub(r"\s+", " ", text_value), max_chars)
    links: list[str] = []
    for elem in root.iter():
        if elem.text and elem.text.strip().startswith(("http://", "https://")):
            links.append(elem.text.strip())
    return ExtractedContent(
        format="xml",
        text=text_value,
        structured={"root_tag": root.tag},
        links=tuple(sorted(dict.fromkeys(links))),
        metadata={"root_tag": root.tag},
        truncated=truncated,
        warnings=tuple(warnings),
    )


def _extract_csv(raw: str, max_chars: int, max_rows: int = 500) -> ExtractedContent:
    stream = io.StringIO(raw)
    rows: list[list[str]] = []
    warnings: list[str] = []
    try:
        reader = csv.reader(stream)
        for index, row in enumerate(reader):
            if index >= max_rows:
                warnings.append("ROW_LIMIT_REACHED")
                break
            rows.append([str(cell) for cell in row])
    except csv.Error:
        warnings.append("INVALID_CSV")
    text = "\n".join(",".join(row) for row in rows)
    text, truncated = _bounded_text(text, max_chars)
    width = max((len(row) for row in rows), default=0)
    return ExtractedContent(
        format="csv",
        text=text,
        structured={"rows": rows},
        links=(),
        metadata={"row_count": len(rows), "max_columns": width},
        truncated=truncated,
        warnings=tuple(warnings),
    )


def _extract_pdf(body: bytes, max_chars: int) -> ExtractedContent:
    try:
        from pypdf import PdfReader
    except ImportError:
        return ExtractedContent(
            format="pdf",
            text="",
            structured=None,
            links=(),
            metadata={},
            truncated=False,
            warnings=("PYPDF_NOT_INSTALLED",),
        )

    warnings: list[str] = []
    try:
        reader = PdfReader(io.BytesIO(body))
        chunks: list[str] = []
        for page in reader.pages:
            try:
                chunks.append(page.extract_text() or "")
            except Exception:  # noqa: BLE001
                warnings.append("PDF_PAGE_EXTRACTION_FAILED")
        text = re.sub(r"\s+", " ", " ".join(chunks)).strip()
        text, truncated = _bounded_text(text, max_chars)
        return ExtractedContent(
            format="pdf",
            text=text,
            structured=None,
            links=tuple(sorted(dict.fromkeys(re.findall(r"https?://[^\s<>]+", text)))),
            metadata={"page_count": len(reader.pages)},
            truncated=truncated,
            warnings=tuple(sorted(dict.fromkeys(warnings))),
        )
    except Exception as exc:  # noqa: BLE001
        return ExtractedContent(
            format="pdf",
            text="",
            structured=None,
            links=(),
            metadata={},
            truncated=False,
            warnings=(f"PDF_PARSE_FAILED:{type(exc).__name__}",),
        )


def extract_content(
    body: bytes,
    *,
    content_type: str | None,
    url: str = "",
    max_chars: int = 250_000,
) -> ExtractedContent:
    ctype = (content_type or "").split(";", 1)[0].strip().lower()
    lower_url = url.lower()
    if ctype == "application/pdf" or lower_url.endswith(".pdf"):
        return _extract_pdf(body, max_chars)

    raw = body.decode("utf-8", errors="replace")
    if ctype in {"text/html", "application/xhtml+xml"} or "<html" in raw[:2048].lower():
        return _extract_html(raw, max_chars)
    if "json" in ctype or lower_url.endswith(".json"):
        return _extract_json(raw, max_chars)
    if "xml" in ctype or lower_url.endswith((".xml", ".rss", ".atom")):
        return _extract_xml(raw, max_chars)
    if ctype in {"text/csv", "application/csv"} or lower_url.endswith(".csv"):
        return _extract_csv(raw, max_chars)

    text, truncated = _bounded_text(raw, max_chars)
    return ExtractedContent(
        format="text",
        text=text,
        structured=None,
        links=(),
        metadata={},
        truncated=truncated,
        warnings=(),
    )
