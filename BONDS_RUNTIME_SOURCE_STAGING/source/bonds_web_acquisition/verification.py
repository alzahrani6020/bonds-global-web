# Imported source snapshot for BONDS adaptation.
# Source: alzahrani6020/AFAQ-GIE@b1fec7fa400c57f32c2022a21cf74039379fc3cf:web_acquisition/verification.py
# STAGING ONLY: not imported by BONDS runtime.

"""Independent read-back verification for externally observable effects."""

from __future__ import annotations

import hashlib
from dataclasses import dataclass
from typing import Any, Mapping

from .fetch import fetch_url


@dataclass(frozen=True)
class VerificationResult:
    state: str
    verified: bool
    reason: str
    evidence: Mapping[str, Any]

    def as_dict(self) -> dict[str, Any]:
        return {
            "state": self.state,
            "verified": self.verified,
            "reason": self.reason,
            "evidence": dict(self.evidence),
        }


def verify_remote_resource(
    url: str,
    *,
    expected_status: int = 200,
    expected_sha256: str | None = None,
    expected_contains: str | None = None,
    timeout_seconds: float = 15.0,
    allow_private_networks: bool = False,
) -> VerificationResult:
    result = fetch_url(
        url,
        timeout_seconds=timeout_seconds,
        allow_private_networks=allow_private_networks,
    )
    if not result.executed:
        return VerificationResult(
            state="BLOCKED",
            verified=False,
            reason=result.evidence.blocked_reason or result.evidence.failure_class or "NOT_EXECUTED",
            evidence=result.evidence.as_dict(),
        )
    if result.evidence.status_code != expected_status:
        return VerificationResult(
            state="FAILED",
            verified=False,
            reason="STATUS_MISMATCH",
            evidence=result.evidence.as_dict(),
        )
    if expected_sha256:
        digest = hashlib.sha256(result.body).hexdigest()
        if digest != expected_sha256:
            return VerificationResult(
                state="FAILED",
                verified=False,
                reason="CONTENT_HASH_MISMATCH",
                evidence={**result.evidence.as_dict(), "observed_sha256": digest},
            )
    if expected_contains is not None and expected_contains not in result.text:
        return VerificationResult(
            state="FAILED",
            verified=False,
            reason="EXPECTED_CONTENT_NOT_OBSERVED",
            evidence=result.evidence.as_dict(),
        )
    return VerificationResult(
        state="EFFECT_VERIFIED",
        verified=True,
        reason="REMOTE_STATE_OBSERVED",
        evidence=result.evidence.as_dict(),
    )
