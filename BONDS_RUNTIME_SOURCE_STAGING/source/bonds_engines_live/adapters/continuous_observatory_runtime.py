# Imported source snapshot for BONDS adaptation.
# Source: alzahrani6020/AFAQ-GIE@b1fec7fa400c57f32c2022a21cf74039379fc3cf:engines_live/adapters/continuous_observatory_runtime.py
# STAGING ONLY: not imported by BONDS runtime.

"""Dedicated continuous-observation runtime for ENG-CAP-153."""

from __future__ import annotations

import hashlib
import json
from datetime import datetime, timezone
from typing import Any, Mapping

from bonds_web_acquisition.change_detection import SourceSnapshot, compare_snapshots
from bonds_web_acquisition.observer import observe_once


def _digest(value: Any) -> str:
    raw = json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(",", ":"), default=str)
    return hashlib.sha256(raw.encode("utf-8")).hexdigest()


def _snapshot_from_payload(raw: Mapping[str, Any], *, source_id: str, label: str) -> SourceSnapshot:
    content = raw.get("content")
    if isinstance(content, str):
        content_b = content.encode("utf-8")
    elif isinstance(content, bytes):
        content_b = content
    else:
        raise ValueError(f"{label}.content must be text or bytes")
    return SourceSnapshot.build(
        source_id=source_id,
        version=str(raw.get("version") or label),
        content=content_b,
        observed_at=str(raw.get("observed_at") or datetime.now(timezone.utc).isoformat()),
        metadata=dict(raw.get("metadata") or {}),
    )


def make_continuous_observatory_runtime_adapter():
    """ENG-CAP-153: one-shot observation primitive for approved schedulers."""

    def handler(payload: Mapping[str, Any]) -> dict[str, Any]:
        action = str(payload.get("action") or "compare_snapshots")
        try:
            if action == "observe":
                source_id = str(payload.get("source_id") or "").strip()
                url = str(payload.get("url") or "").strip()
                if not source_id or not url:
                    raise ValueError("observe requires source_id and url")
                previous = None
                prev_raw = payload.get("previous")
                if isinstance(prev_raw, Mapping):
                    previous = _snapshot_from_payload(
                        prev_raw, source_id=source_id, label="previous"
                    )
                result = observe_once(
                    source_id,
                    url,
                    previous=previous,
                    allow_private_networks=bool(payload.get("allow_private_networks", False)),
                    timeout_seconds=min(max(float(payload.get("timeout_seconds") or 15), 1.0), 30.0),
                )
                out = result.as_dict()
                ok = result.state not in {"BLOCKED", "FAILED"} and result.snapshot is not None
                return {
                    "ok": ok,
                    "executed": True,
                    "message": f"ENG-CAP-153 observation state={result.state}",
                    "evidence": {
                        "observation": out,
                        "observation_digest": _digest(out),
                        "scheduler_created": False,
                        "caller_owned_checkpoint": True,
                        "evidence_backed": bool(result.evidence_ref),
                    },
                }

            if action == "compare_snapshots":
                source_id = str(payload.get("source_id") or "probe-source").strip()
                previous_raw = payload.get("previous") or {
                    "version": "v1",
                    "content": "version one",
                    "metadata": {"channel": "probe"},
                }
                current_raw = payload.get("current") or {
                    "version": "v2",
                    "content": "version two",
                    "metadata": {"channel": "probe"},
                }
                if not isinstance(previous_raw, Mapping) or not isinstance(current_raw, Mapping):
                    raise ValueError("previous and current must be objects")
                previous = _snapshot_from_payload(previous_raw, source_id=source_id, label="previous")
                current = _snapshot_from_payload(current_raw, source_id=source_id, label="current")
                decision = compare_snapshots(previous, current).as_dict()
                evidence = {
                    "source_id": source_id,
                    "previous_hash": previous.content_hash,
                    "current_hash": current.content_hash,
                    "change": decision,
                    "change_trigger": decision["state"] != "UNCHANGED",
                    "research_trigger": decision["state"] == "SEMANTIC_CHANGE",
                    "notification_candidate": decision["state"] != "UNCHANGED",
                    "scheduler_created": False,
                    "caller_owned_checkpoint": True,
                }
                return {
                    "ok": True,
                    "executed": True,
                    "message": f"ENG-CAP-153 comparison state={decision['state']}",
                    "evidence": {
                        "observation": evidence,
                        "observation_digest": _digest(evidence),
                        "evidence_backed": True,
                    },
                }

            raise ValueError("unsupported action")
        except Exception as exc:
            return {
                "ok": False,
                "executed": False,
                "message": f"ENG-CAP-153 observation blocked: {type(exc).__name__}: {exc}",
                "evidence": {"error": f"{type(exc).__name__}: {exc}", "fail_closed": True},
            }

    return handler
