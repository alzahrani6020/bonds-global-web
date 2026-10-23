# Imported source snapshot for BONDS adaptation.
# Source: alzahrani6020/AFAQ-GIE@b1fec7fa400c57f32c2022a21cf74039379fc3cf:web_acquisition/observer.py
# STAGING ONLY: not imported by BONDS runtime.

"""One-shot continuous-observation primitive with durable caller-owned state.

This module does not create a scheduler. Callers can run observe_once from an
approved scheduler and persist the returned snapshot in their owned state
store.
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Any

from .change_detection import SourceSnapshot, compare_snapshots
from .fetch import fetch_url


@dataclass(frozen=True)
class ObservationResult:
    source_id: str
    state: str
    snapshot: SourceSnapshot | None
    change: dict[str, Any] | None
    evidence_ref: str | None
    failure_class: str | None

    def as_dict(self) -> dict[str, Any]:
        return {
            "source_id": self.source_id,
            "state": self.state,
            "snapshot": None if self.snapshot is None else {
                "source_id": self.snapshot.source_id,
                "version": self.snapshot.version,
                "content_hash": self.snapshot.content_hash,
                "normalized_text_hash": self.snapshot.normalized_text_hash,
                "observed_at": self.snapshot.observed_at,
                "metadata": dict(self.snapshot.metadata),
            },
            "change": self.change,
            "evidence_ref": self.evidence_ref,
            "failure_class": self.failure_class,
        }


def observe_once(
    source_id: str,
    url: str,
    *,
    previous: SourceSnapshot | None = None,
    allow_private_networks: bool = False,
    timeout_seconds: float = 15.0,
) -> ObservationResult:
    result = fetch_url(
        url,
        allow_private_networks=allow_private_networks,
        timeout_seconds=timeout_seconds,
    )
    if not result.ok:
        return ObservationResult(
            source_id=source_id,
            state="BLOCKED" if not result.executed else "FAILED",
            snapshot=None,
            change=None,
            evidence_ref=None,
            failure_class=result.evidence.failure_class or result.evidence.blocked_reason,
        )

    observed_at = datetime.now(timezone.utc).isoformat()
    version = result.evidence.headers.get("etag") or result.evidence.headers.get("last-modified") or result.evidence.content_hash or observed_at
    snapshot = SourceSnapshot.build(
        source_id=source_id,
        version=str(version),
        content=result.body,
        observed_at=observed_at,
        metadata={
            "url": result.evidence.final_url or url,
            "status_code": result.evidence.status_code,
            "content_type": result.evidence.content_type,
            "etag": result.evidence.headers.get("etag"),
            "last_modified": result.evidence.headers.get("last-modified"),
        },
    )
    evidence_ref = f"web:{snapshot.content_hash}:{url}"
    if previous is None:
        state = "INITIAL_SNAPSHOT"
        change = None
    else:
        decision = compare_snapshots(previous, snapshot)
        state = decision.state
        change = decision.as_dict()

    return ObservationResult(
        source_id=source_id,
        state=state,
        snapshot=snapshot,
        change=change,
        evidence_ref=evidence_ref,
        failure_class=None,
    )
