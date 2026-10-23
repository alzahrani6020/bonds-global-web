# Imported source snapshot for BONDS adaptation.
# Source: alzahrani6020/AFAQ-GIE@b1fec7fa400c57f32c2022a21cf74039379fc3cf:web_acquisition/decomposition.py
# STAGING ONLY: not imported by BONDS runtime.

"""Evidence-derived capability decomposition from observed platform signals.

This is deterministic signal decomposition, not semantic omniscience. Unknown
or weakly supported capabilities remain candidates until active probes or
benchmarks verify them.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Mapping

from .api_discovery import ApiSurface
from .network_intelligence import NetworkOperation
from .platform_model import PlatformModel


@dataclass(frozen=True)
class CapabilityCandidate:
    capability: str
    confidence: str
    evidence_refs: tuple[str, ...]
    basis: tuple[str, ...]
    verification_required: bool = True

    def as_dict(self) -> dict[str, Any]:
        return {
            "capability": self.capability,
            "confidence": self.confidence,
            "evidence_refs": list(self.evidence_refs),
            "basis": list(self.basis),
            "verification_required": self.verification_required,
        }


_SURFACE_CAPABILITIES = {
    "api": ("structured_api",),
    "sdk": ("sdk_integration",),
    "auth": ("authentication", "authorization"),
    "webhooks": ("webhook_delivery",),
    "models": ("model_service",),
    "limits": ("quota_or_rate_limiting",),
    "status": ("service_health_observability",),
}


def decompose_capabilities(
    platform: PlatformModel,
    *,
    api_surfaces: tuple[ApiSurface, ...] = (),
    network_operations: tuple[NetworkOperation, ...] = (),
) -> tuple[CapabilityCandidate, ...]:
    found: dict[str, dict[str, Any]] = {}

    def add(capability: str, *, evidence_ref: str | None, basis: str, confidence: str) -> None:
        item = found.setdefault(
            capability,
            {"evidence": [], "basis": [], "confidence": "LOW"},
        )
        if evidence_ref:
            item["evidence"].append(evidence_ref)
        item["basis"].append(basis)
        rank = {"LOW": 0, "MEDIUM": 1, "HIGH": 2}
        if rank[confidence] > rank[item["confidence"]]:
            item["confidence"] = confidence

    for surface in platform.surfaces:
        if not surface.observed:
            continue
        for capability in _SURFACE_CAPABILITIES.get(surface.kind, ()):
            for ref in surface.evidence_refs or (None,):
                add(
                    capability,
                    evidence_ref=ref,
                    basis=f"surface:{surface.kind}",
                    confidence="MEDIUM",
                )

    for api in api_surfaces:
        if not api.observed:
            continue
        if api.kind == "openapi":
            add(
                "structured_api",
                evidence_ref=api.evidence_ref,
                basis="openapi_document",
                confidence="HIGH",
            )
            for operation in api.operations:
                method, _, path = operation.partition(" ")
                add(
                    f"api_operation:{method.lower()}:{path}",
                    evidence_ref=api.evidence_ref,
                    basis="openapi_operation",
                    confidence="HIGH",
                )
        elif "graphql" in api.kind:
            add(
                "graphql_api_candidate",
                evidence_ref=api.evidence_ref,
                basis="graphql_endpoint_observed",
                confidence="MEDIUM",
            )

    for operation in network_operations:
        if operation.candidate_kind == "resource":
            continue
        evidence_ref = f"network:{operation.method}:{operation.url}"
        add(
            operation.candidate_kind,
            evidence_ref=evidence_ref,
            basis=f"browser_network_action:{operation.action_index}",
            confidence="HIGH" if operation.response_status and 200 <= operation.response_status < 400 else "MEDIUM",
        )

    return tuple(
        CapabilityCandidate(
            capability=capability,
            confidence=str(data["confidence"]),
            evidence_refs=tuple(sorted(dict.fromkeys(data["evidence"]))),
            basis=tuple(sorted(dict.fromkeys(data["basis"]))),
            verification_required=True,
        )
        for capability, data in sorted(found.items())
    )
