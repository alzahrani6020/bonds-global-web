# Imported source snapshot for BONDS adaptation.
# Source: alzahrani6020/AFAQ-GIE@b1fec7fa400c57f32c2022a21cf74039379fc3cf:web_acquisition/assimilation.py
# STAGING ONLY: not imported by BONDS runtime.

"""Governed capability assimilation lifecycle.

This state machine coordinates discovery through adoption candidacy. It never
promotes or activates a capability by itself.
"""

from __future__ import annotations

from dataclasses import dataclass, replace
from typing import Any


_STATES = (
    "DISCOVERED",
    "FINGERPRINTED",
    "MAPPED",
    "EQUIVALENCE_TESTED",
    "GAP_CLASSIFIED",
    "SHADOW_TESTED",
    "BENCHMARKED",
    "TEACHING_READY",
    "ADOPTION_CANDIDATE",
)
_NEXT = {state: _STATES[index + 1] for index, state in enumerate(_STATES[:-1])}


@dataclass(frozen=True)
class AssimilationRecord:
    subject_id: str
    state: str = "DISCOVERED"
    evidence_refs: tuple[str, ...] = ()
    limitations: tuple[str, ...] = ()
    promotion_allowed: bool = False

    def as_dict(self) -> dict[str, Any]:
        return {
            "subject_id": self.subject_id,
            "state": self.state,
            "evidence_refs": list(self.evidence_refs),
            "limitations": list(self.limitations),
            "promotion_allowed": False,
        }


def advance(
    record: AssimilationRecord,
    *,
    target_state: str,
    evidence_refs: tuple[str, ...],
    gate_passed: bool,
) -> AssimilationRecord:
    expected = _NEXT.get(record.state)
    if expected != target_state:
        raise ValueError(f"invalid assimilation transition: {record.state} -> {target_state}")
    if not gate_passed:
        raise ValueError("assimilation gate did not pass")
    if not evidence_refs:
        raise ValueError("assimilation transition requires evidence")
    merged = tuple(sorted(dict.fromkeys((*record.evidence_refs, *evidence_refs))))
    return replace(record, state=target_state, evidence_refs=merged, promotion_allowed=False)
