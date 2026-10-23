# Imported source snapshot for BONDS adaptation.
# Source: alzahrani6020/AFAQ-GIE@b1fec7fa400c57f32c2022a21cf74039379fc3cf:web_acquisition/strategy.py
# STAGING ONLY: not imported by BONDS runtime.

"""Mission-driven acquisition strategy selection."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any


@dataclass(frozen=True)
class AcquisitionPlan:
    channels: tuple[str, ...]
    reasons: tuple[str, ...]
    stop_conditions: tuple[str, ...]
    fallback_order: tuple[str, ...]

    def as_dict(self) -> dict[str, Any]:
        return {
            "channels": list(self.channels),
            "reasons": list(self.reasons),
            "stop_conditions": list(self.stop_conditions),
            "fallback_order": list(self.fallback_order),
        }


def plan_acquisition(
    *,
    mission_terms: tuple[str, ...] = (),
    known_surfaces: tuple[str, ...] = (),
    requires_interaction: bool = False,
    requires_authenticated_state: bool = False,
    requires_side_effect: bool = False,
) -> AcquisitionPlan:
    channels: list[str] = []
    reasons: list[str] = []

    surfaces = set(known_surfaces)
    if "api" in surfaces:
        channels.append("STRUCTURED_API")
        reasons.append("API_SURFACE_OBSERVED")
    channels.append("DIRECT_HTTP")
    reasons.append("CHEAPEST_READ_ONLY_ACQUISITION_FIRST")
    channels.append("CRAWL")
    reasons.append("DISCOVER_UNMAPPED_SURFACES")
    if requires_interaction or requires_authenticated_state or requires_side_effect:
        channels.append("BROWSER")
        reasons.append("STATEFUL_OR_INTERACTIVE_EXECUTION_REQUIRED")

    fallback = tuple(dict.fromkeys(("STRUCTURED_API", "DIRECT_HTTP", "CRAWL", "BROWSER")))
    stop = (
        "MISSION_REQUIRED_EVIDENCE_OBSERVED",
        "COVERAGE_THRESHOLD_REACHED",
        "AUTHORITY_OR_POLICY_BLOCK",
        "BUDGET_EXHAUSTED",
    )
    return AcquisitionPlan(
        channels=tuple(dict.fromkeys(channels)),
        reasons=tuple(reasons),
        stop_conditions=stop,
        fallback_order=fallback,
    )
