# Imported source snapshot for BONDS adaptation.
# Source: alzahrani6020/AFAQ-GIE@b1fec7fa400c57f32c2022a21cf74039379fc3cf:web_acquisition/platform_model.py
# STAGING ONLY: not imported by BONDS runtime.

"""Platform surface model derived from measured crawl observations."""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any

from .contracts import CrawlResult


_EXPECTED_SURFACES = (
    "docs",
    "api",
    "sdk",
    "pricing",
    "changelog",
    "status",
    "auth",
    "limits",
    "webhooks",
    "models",
    "policies",
)


@dataclass(frozen=True)
class PlatformSurface:
    kind: str
    urls: tuple[str, ...]
    evidence_refs: tuple[str, ...]
    observed: bool


@dataclass(frozen=True)
class PlatformModel:
    surfaces: tuple[PlatformSurface, ...]
    observed_surface_types: tuple[str, ...]
    missing_expected_surfaces: tuple[str, ...]
    render_required_urls: tuple[str, ...]
    blocked_urls: tuple[str, ...]
    failed_urls: tuple[str, ...]
    coverage: dict[str, Any]
    sufficiently_explored: bool
    closure_reason: str

    def as_dict(self) -> dict[str, Any]:
        return {
            "surfaces": [
                {
                    "kind": item.kind,
                    "urls": list(item.urls),
                    "evidence_refs": list(item.evidence_refs),
                    "observed": item.observed,
                }
                for item in self.surfaces
            ],
            "observed_surface_types": list(self.observed_surface_types),
            "missing_expected_surfaces": list(self.missing_expected_surfaces),
            "render_required_urls": list(self.render_required_urls),
            "blocked_urls": list(self.blocked_urls),
            "failed_urls": list(self.failed_urls),
            "coverage": dict(self.coverage),
            "sufficiently_explored": self.sufficiently_explored,
            "closure_reason": self.closure_reason,
        }


def build_platform_model(
    result: CrawlResult,
    *,
    expected_surfaces: tuple[str, ...] = _EXPECTED_SURFACES,
    minimum_url_coverage: float = 0.80,
    minimum_evidence_coverage: float = 0.95,
) -> PlatformModel:
    by_surface: dict[str, list[str]] = {}
    refs_by_surface: dict[str, list[str]] = {}

    for page in result.pages:
        ref = f"web:{page.content_hash or 'nohash'}:{page.url}"
        for surface in page.discovered_surfaces:
            by_surface.setdefault(surface, []).append(page.url)
            refs_by_surface.setdefault(surface, []).append(ref)

    observed = tuple(sorted(by_surface))
    missing = tuple(sorted(surface for surface in expected_surfaces if surface not in by_surface))
    surfaces = tuple(
        PlatformSurface(
            kind=kind,
            urls=tuple(sorted(dict.fromkeys(by_surface.get(kind, [])))),
            evidence_refs=tuple(sorted(dict.fromkeys(refs_by_surface.get(kind, [])))),
            observed=kind in by_surface,
        )
        for kind in sorted(set(expected_surfaces) | set(observed))
    )

    blocked = result.checkpoint.blocked
    failed = result.checkpoint.failed
    render_required = tuple(sorted(page.url for page in result.pages if page.render_required))
    enough = bool(
        result.pages
        and result.coverage.url_coverage >= minimum_url_coverage
        and result.coverage.evidence_coverage >= minimum_evidence_coverage
        and not result.coverage.pending_count
    )
    if enough and not missing:
        closure = "SURFACE_AND_EVIDENCE_COVERAGE_SATISFIED"
    elif enough:
        closure = "BOUNDED_COVERAGE_SATISFIED_WITH_EXPLICIT_SURFACE_GAPS"
    else:
        closure = "EXPLORATION_REMAINS_INCOMPLETE"

    return PlatformModel(
        surfaces=surfaces,
        observed_surface_types=observed,
        missing_expected_surfaces=missing,
        render_required_urls=render_required,
        blocked_urls=blocked,
        failed_urls=failed,
        coverage=result.coverage.as_dict(),
        sufficiently_explored=enough,
        closure_reason=closure,
    )
