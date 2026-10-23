# Imported source snapshot for BONDS adaptation.
# Source: alzahrani6020/AFAQ-GIE@b1fec7fa400c57f32c2022a21cf74039379fc3cf:web_acquisition/orchestrator.py
# STAGING ONLY: not imported by BONDS runtime.

"""End-to-end technology exploration mission orchestrator.

Coordinates existing acquisition primitives without owning their internal
responsibilities. A report may be execution-complete while still explicitly
not mission-verified or not sufficiently explored.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any

from .api_discovery import discover_api_surfaces
from .browser import BrowserAction, run_browser
from .contracts import CrawlRequest
from .crawler import crawl
from .decomposition import decompose_capabilities
from .network_intelligence import derive_network_operations
from .platform_model import build_platform_model
from .strategy import plan_acquisition


@dataclass(frozen=True)
class ExplorationVerificationContract:
    required_surfaces: tuple[str, ...] = ()
    required_terms: tuple[str, ...] = ()
    minimum_url_coverage: float = 0.80
    minimum_evidence_coverage: float = 0.95
    require_frontier_exhausted: bool = True

    def __post_init__(self) -> None:
        for name, value in (
            ("minimum_url_coverage", self.minimum_url_coverage),
            ("minimum_evidence_coverage", self.minimum_evidence_coverage),
        ):
            if not 0.0 <= float(value) <= 1.0:
                raise ValueError(f"{name} must be between 0 and 1")


@dataclass(frozen=True)
class ExplorationMission:
    seed_urls: tuple[str, ...]
    mission_terms: tuple[str, ...] = ()
    expected_surfaces: tuple[str, ...] = ()
    browser_actions: tuple[BrowserAction, ...] = ()
    max_pages: int = 100
    max_depth: int = 4
    allow_private_networks: bool = False
    require_interaction: bool = False
    require_authenticated_state: bool = False
    require_side_effect: bool = False
    verification: ExplorationVerificationContract | None = None
    browser_storage_state: dict[str, Any] | None = field(default=None, repr=False)


@dataclass(frozen=True)
class ExplorationReport:
    plan: dict[str, Any]
    crawl: dict[str, Any]
    platform: dict[str, Any]
    api_surfaces: tuple[dict[str, Any], ...]
    browser: dict[str, Any] | None
    network_operations: tuple[dict[str, Any], ...]
    capability_candidates: tuple[dict[str, Any], ...]
    evidence_refs: tuple[str, ...]
    sufficiently_explored: bool
    mission_verified: bool
    verification: dict[str, Any]
    unknowns: tuple[str, ...]

    def as_dict(self) -> dict[str, Any]:
        return {
            "plan": dict(self.plan),
            "crawl": dict(self.crawl),
            "platform": dict(self.platform),
            "api_surfaces": list(self.api_surfaces),
            "browser": None if self.browser is None else dict(self.browser),
            "network_operations": list(self.network_operations),
            "capability_candidates": list(self.capability_candidates),
            "evidence_refs": list(self.evidence_refs),
            "sufficiently_explored": self.sufficiently_explored,
            "mission_verified": self.mission_verified,
            "verification": dict(self.verification),
            "unknowns": list(self.unknowns),
        }


def _verify_exploration_mission(
    mission: ExplorationMission,
    *,
    crawl_result,
    platform,
    browser_result,
    evidence_refs: tuple[str, ...],
) -> dict[str, Any]:
    contract = mission.verification
    if contract is None:
        return {
            "verified": False,
            "contract_provided": False,
            "checks": [],
            "blockers": ["NO_EXPLICIT_VERIFICATION_CONTRACT"],
            "evidence_refs": list(evidence_refs),
        }

    observed_surfaces = set(platform.observed_surface_types)
    observed_terms = {
        str(term).strip().lower()
        for page in crawl_result.pages
        for term in page.semantic_hints
        if str(term).strip()
    }
    required_surfaces = {
        str(item).strip().lower()
        for item in contract.required_surfaces
        if str(item).strip()
    }
    required_terms = {
        str(item).strip().lower()
        for item in contract.required_terms
        if str(item).strip()
    }

    missing_surfaces = sorted(required_surfaces - {
        str(item).strip().lower() for item in observed_surfaces
    })
    missing_terms = sorted(required_terms - observed_terms)

    checks = [
        {
            "name": "required_surfaces",
            "passed": not missing_surfaces,
            "expected": sorted(required_surfaces),
            "observed": sorted(observed_surfaces),
            "missing": missing_surfaces,
        },
        {
            "name": "required_terms",
            "passed": not missing_terms,
            "expected": sorted(required_terms),
            "observed": sorted(observed_terms),
            "missing": missing_terms,
        },
        {
            "name": "url_coverage",
            "passed": crawl_result.coverage.url_coverage >= contract.minimum_url_coverage,
            "expected_minimum": contract.minimum_url_coverage,
            "observed": crawl_result.coverage.url_coverage,
        },
        {
            "name": "evidence_coverage",
            "passed": (
                crawl_result.coverage.evidence_coverage
                >= contract.minimum_evidence_coverage
            ),
            "expected_minimum": contract.minimum_evidence_coverage,
            "observed": crawl_result.coverage.evidence_coverage,
        },
        {
            "name": "frontier_exhausted",
            "passed": (
                not contract.require_frontier_exhausted
                or crawl_result.coverage.pending_count == 0
            ),
            "expected": contract.require_frontier_exhausted,
            "observed_pending_count": crawl_result.coverage.pending_count,
        },
    ]

    if mission.require_interaction or mission.browser_actions:
        checks.append({
            "name": "browser_execution",
            "passed": bool(browser_result and browser_result.ok),
            "expected": True,
            "observed": bool(browser_result and browser_result.ok),
        })

    blockers: list[str] = []
    if mission.require_authenticated_state:
        blockers.append("AUTHENTICATED_STATE_REQUIRES_INDEPENDENT_VERIFICATION")
    if mission.require_side_effect:
        blockers.append("SIDE_EFFECT_REQUIRES_INDEPENDENT_VERIFICATION")
    if not evidence_refs:
        blockers.append("NO_EVIDENCE_REFS")

    failed_checks = [item["name"] for item in checks if not item["passed"]]
    blockers.extend(f"FAILED_CHECK:{name}" for name in failed_checks)
    blockers = sorted(dict.fromkeys(blockers))

    return {
        "verified": not blockers,
        "contract_provided": True,
        "checks": checks,
        "blockers": blockers,
        "evidence_refs": list(evidence_refs),
    }


def explore(mission: ExplorationMission) -> ExplorationReport:
    if not mission.seed_urls:
        raise ValueError("exploration mission requires seed_urls")

    plan = plan_acquisition(
        mission_terms=mission.mission_terms,
        requires_interaction=mission.require_interaction or bool(mission.browser_actions),
        requires_authenticated_state=mission.require_authenticated_state,
        requires_side_effect=mission.require_side_effect,
    )

    crawl_result = crawl(
        CrawlRequest(
            seed_urls=mission.seed_urls,
            mission_terms=mission.mission_terms,
            max_pages=mission.max_pages,
            max_depth=mission.max_depth,
            allow_private_networks=mission.allow_private_networks,
        )
    )
    expected = mission.expected_surfaces or (
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
    platform = build_platform_model(
        crawl_result,
        expected_surfaces=expected,
    )

    api_surfaces = discover_api_surfaces(
        mission.seed_urls,
        allow_private_networks=mission.allow_private_networks,
    )

    browser_result = None
    network_operations = ()
    if mission.require_interaction or mission.browser_actions or mission.require_authenticated_state:
        browser_result = run_browser(
            mission.seed_urls[0],
            actions=mission.browser_actions,
            allow_private_networks=mission.allow_private_networks,
            capture_network=True,
            storage_state=mission.browser_storage_state,
        )
        network_operations = derive_network_operations(browser_result.network)

    candidates = decompose_capabilities(
        platform,
        api_surfaces=api_surfaces,
        network_operations=network_operations,
    )

    evidence: list[str] = list(crawl_result.evidence_refs)
    for surface in api_surfaces:
        if surface.evidence_ref:
            evidence.append(surface.evidence_ref)
    if browser_result:
        if browser_result.html_sha256:
            evidence.append(f"browserdom:{browser_result.html_sha256}")
        if browser_result.screenshot_sha256:
            evidence.append(f"browserscreen:{browser_result.screenshot_sha256}")

    evidence_refs = tuple(sorted(dict.fromkeys(evidence)))
    verification = _verify_exploration_mission(
        mission,
        crawl_result=crawl_result,
        platform=platform,
        browser_result=browser_result,
        evidence_refs=evidence_refs,
    )

    unknowns = list(crawl_result.coverage.unknowns)
    unknowns.extend(f"MISSING_SURFACE:{item}" for item in platform.missing_expected_surfaces)
    if browser_result and not browser_result.ok:
        unknowns.append(f"BROWSER:{browser_result.failure_class or browser_result.state}")

    return ExplorationReport(
        plan=plan.as_dict(),
        crawl=crawl_result.as_dict(),
        platform=platform.as_dict(),
        api_surfaces=tuple(item.as_dict() for item in api_surfaces),
        browser=None if browser_result is None else browser_result.as_dict(),
        network_operations=tuple(item.as_dict() for item in network_operations),
        capability_candidates=tuple(item.as_dict() for item in candidates),
        evidence_refs=evidence_refs,
        sufficiently_explored=platform.sufficiently_explored,
        mission_verified=bool(verification["verified"]),
        verification=verification,
        unknowns=tuple(sorted(dict.fromkeys(unknowns))),
    )
