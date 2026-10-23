# Imported source snapshot for BONDS adaptation.
# Source: alzahrani6020/AFAQ-GIE@b1fec7fa400c57f32c2022a21cf74039379fc3cf:web_acquisition/compliance.py
# STAGING ONLY: not imported by BONDS runtime.

"""Compliance-policy inputs for external acquisition.

This module does not encode jurisdiction law. It consumes versioned policy
decisions produced by the responsible compliance/policy layer and fail-closes
provider execution when a required decision is absent or negative.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any


@dataclass(frozen=True)
class ProcessingProfile:
    personal_data: bool
    sensitive_data: bool
    data_categories: tuple[str, ...] = ()
    data_subject_jurisdictions: tuple[str, ...] = ()
    origin_jurisdictions: tuple[str, ...] = ()
    destination_jurisdictions: tuple[str, ...] = ()
    purposes: tuple[str, ...] = ()
    automated_decision: bool = False
    continuous_monitoring: bool = False
    emerging_technology: bool = False
    cross_border_paths: tuple[str, ...] = ()


@dataclass(frozen=True)
class ComplianceDecision:
    decision_id: str
    state: str
    policy_versions: tuple[str, ...]
    provider_id: str | None = None
    transfer_legal_path: str | None = None
    protection_level_assessment_ref: str | None = None
    transfer_risk_assessment_ref: str | None = None
    required_controls: tuple[str, ...] = ()
    evidence_refs: tuple[str, ...] = ()
    limitations: tuple[str, ...] = ()
    metadata: dict[str, Any] = field(default_factory=dict)


@dataclass(frozen=True)
class ComplianceGateResult:
    allowed: bool
    state: str
    reason: str
    required_controls: tuple[str, ...]
    evidence_refs: tuple[str, ...]

    def as_dict(self) -> dict[str, Any]:
        return {
            "allowed": self.allowed,
            "state": self.state,
            "reason": self.reason,
            "required_controls": list(self.required_controls),
            "evidence_refs": list(self.evidence_refs),
        }


def evaluate_external_execution(
    profile: ProcessingProfile,
    decision: ComplianceDecision | None,
    *,
    provider_id: str | None,
) -> ComplianceGateResult:
    needs_policy = bool(
        profile.personal_data
        or profile.sensitive_data
        or profile.cross_border_paths
        or profile.destination_jurisdictions
    )
    if not needs_policy:
        return ComplianceGateResult(
            allowed=True,
            state="NOT_REQUIRED_FOR_DECLARED_CONTEXT",
            reason="NO_DECLARED_PERSONAL_OR_CROSS_BORDER_DATA_CONTEXT",
            required_controls=(),
            evidence_refs=(),
        )

    if decision is None:
        return ComplianceGateResult(
            allowed=False,
            state="REVIEW_REQUIRED",
            reason="COMPLIANCE_DECISION_REQUIRED",
            required_controls=(),
            evidence_refs=(),
        )

    if provider_id and decision.provider_id and decision.provider_id != provider_id:
        return ComplianceGateResult(
            allowed=False,
            state="BLOCK",
            reason="COMPLIANCE_DECISION_PROVIDER_MISMATCH",
            required_controls=decision.required_controls,
            evidence_refs=decision.evidence_refs,
        )

    if not decision.policy_versions or not decision.evidence_refs:
        return ComplianceGateResult(
            allowed=False,
            state="REVIEW_REQUIRED",
            reason="COMPLIANCE_EVIDENCE_OR_POLICY_VERSION_MISSING",
            required_controls=decision.required_controls,
            evidence_refs=decision.evidence_refs,
        )

    if decision.state not in {"ALLOW", "ALLOW_WITH_CONTROLS"}:
        return ComplianceGateResult(
            allowed=False,
            state=decision.state,
            reason="COMPLIANCE_DECISION_DOES_NOT_ALLOW_EXECUTION",
            required_controls=decision.required_controls,
            evidence_refs=decision.evidence_refs,
        )

    return ComplianceGateResult(
        allowed=True,
        state=decision.state,
        reason="VERSIONED_COMPLIANCE_DECISION_ALLOWS_EXECUTION",
        required_controls=decision.required_controls,
        evidence_refs=decision.evidence_refs,
    )
