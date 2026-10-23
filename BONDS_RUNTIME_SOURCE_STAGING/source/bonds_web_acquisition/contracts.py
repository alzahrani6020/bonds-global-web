# Imported source snapshot for BONDS adaptation.
# Source: alzahrani6020/AFAQ-GIE@b1fec7fa400c57f32c2022a21cf74039379fc3cf:web_acquisition/contracts.py
# STAGING ONLY: not imported by BONDS runtime.

"""Provider-neutral contracts for governed external web acquisition.

These contracts describe observable execution truth. They do not grant
authority and they do not equate a declaration with a proven capability.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from enum import Enum
from typing import Any


class AcquisitionState(str, Enum):
    PLANNED = "PLANNED"
    DISPATCHED = "DISPATCHED"
    ACKNOWLEDGED = "ACKNOWLEDGED"
    EXECUTED = "EXECUTED"
    EFFECT_OBSERVED = "EFFECT_OBSERVED"
    EFFECT_VERIFIED = "EFFECT_VERIFIED"
    MISSION_VERIFIED = "MISSION_VERIFIED"
    BLOCKED = "BLOCKED"
    FAILED = "FAILED"


@dataclass(frozen=True)
class FetchEvidence:
    url: str
    requested_at: str
    status_code: int | None
    content_type: str | None
    content_length: int
    content_hash: str | None
    elapsed_ms: float
    final_url: str | None
    headers: dict[str, str] = field(default_factory=dict)
    failure_class: str | None = None
    blocked_reason: str | None = None

    def as_dict(self) -> dict[str, Any]:
        return {
            "url": self.url,
            "requested_at": self.requested_at,
            "status_code": self.status_code,
            "content_type": self.content_type,
            "content_length": self.content_length,
            "content_hash": self.content_hash,
            "elapsed_ms": self.elapsed_ms,
            "final_url": self.final_url,
            "headers": dict(self.headers),
            "failure_class": self.failure_class,
            "blocked_reason": self.blocked_reason,
        }


@dataclass(frozen=True)
class FetchResult:
    ok: bool
    executed: bool
    body: bytes
    evidence: FetchEvidence

    @property
    def text(self) -> str:
        if not self.body:
            return ""
        return self.body.decode("utf-8", errors="replace")


@dataclass(frozen=True)
class CrawlRequest:
    seed_urls: tuple[str, ...]
    mission_terms: tuple[str, ...] = ()
    max_pages: int = 100
    max_depth: int = 4
    max_bytes_per_page: int = 2_000_000
    max_total_bytes: int = 50_000_000
    per_host_page_budget: int = 100
    timeout_seconds: float = 15.0
    obey_robots: bool = True
    allow_subdomains: bool = True
    allow_private_networks: bool = False
    render_fallback: bool = True
    max_rendered_pages: int = 20
    allowed_hosts: tuple[str, ...] = ()
    user_agent: str = "BONDS-GIE-WebAcquisition/1.0"

    def __post_init__(self) -> None:
        if not self.seed_urls:
            raise ValueError("seed_urls must not be empty")
        if self.max_pages <= 0:
            raise ValueError("max_pages must be positive")
        if self.max_depth < 0:
            raise ValueError("max_depth must be >= 0")
        if self.max_bytes_per_page <= 0:
            raise ValueError("max_bytes_per_page must be positive")
        if self.max_total_bytes <= 0:
            raise ValueError("max_total_bytes must be positive")
        if self.per_host_page_budget <= 0:
            raise ValueError("per_host_page_budget must be positive")
        if self.max_rendered_pages < 0:
            raise ValueError("max_rendered_pages must be >= 0")
        if self.timeout_seconds <= 0:
            raise ValueError("timeout_seconds must be positive")


@dataclass(frozen=True)
class PageObservation:
    url: str
    depth: int
    fetch: FetchEvidence
    title: str | None
    links: tuple[str, ...]
    discovered_surfaces: tuple[str, ...]
    render_required: bool
    semantic_hints: tuple[str, ...]
    content_hash: str | None
    semantic_fingerprint: str | None = None
    near_duplicate_of: str | None = None
    content_format: str | None = None
    extracted_text_hash: str | None = None
    extraction_warnings: tuple[str, ...] = ()

    def as_dict(self) -> dict[str, Any]:
        return {
            "url": self.url,
            "depth": self.depth,
            "fetch": self.fetch.as_dict(),
            "title": self.title,
            "links": list(self.links),
            "discovered_surfaces": list(self.discovered_surfaces),
            "render_required": self.render_required,
            "semantic_hints": list(self.semantic_hints),
            "content_hash": self.content_hash,
            "semantic_fingerprint": self.semantic_fingerprint,
            "near_duplicate_of": self.near_duplicate_of,
            "content_format": self.content_format,
            "extracted_text_hash": self.extracted_text_hash,
            "extraction_warnings": list(self.extraction_warnings),
        }


@dataclass(frozen=True)
class CrawlCheckpoint:
    pending: tuple[tuple[float, int, str], ...]
    visited: tuple[str, ...]
    discovered: tuple[str, ...]
    failed: tuple[str, ...]
    blocked: tuple[str, ...]


@dataclass(frozen=True)
class CoverageReport:
    discovered_count: int
    visited_count: int
    failed_count: int
    blocked_count: int
    pending_count: int
    url_coverage: float
    evidence_coverage: float
    surface_types: tuple[str, ...]
    unknowns: tuple[str, ...]
    near_duplicate_count: int = 0

    def as_dict(self) -> dict[str, Any]:
        return {
            "discovered_count": self.discovered_count,
            "visited_count": self.visited_count,
            "failed_count": self.failed_count,
            "blocked_count": self.blocked_count,
            "pending_count": self.pending_count,
            "url_coverage": self.url_coverage,
            "evidence_coverage": self.evidence_coverage,
            "surface_types": list(self.surface_types),
            "unknowns": list(self.unknowns),
            "near_duplicate_count": self.near_duplicate_count,
        }


@dataclass(frozen=True)
class CrawlResult:
    state: AcquisitionState
    pages: tuple[PageObservation, ...]
    coverage: CoverageReport
    checkpoint: CrawlCheckpoint
    evidence_refs: tuple[str, ...]
    reason: str

    def as_dict(self) -> dict[str, Any]:
        return {
            "state": self.state.value,
            "pages": [page.as_dict() for page in self.pages],
            "coverage": self.coverage.as_dict(),
            "checkpoint": {
                "pending": [list(item) for item in self.checkpoint.pending],
                "visited": list(self.checkpoint.visited),
                "discovered": list(self.checkpoint.discovered),
                "failed": list(self.checkpoint.failed),
                "blocked": list(self.checkpoint.blocked),
            },
            "evidence_refs": list(self.evidence_refs),
            "reason": self.reason,
        }
