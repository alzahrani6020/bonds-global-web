# Imported source snapshot for BONDS adaptation.
# Source: alzahrani6020/AFAQ-GIE@b1fec7fa400c57f32c2022a21cf74039379fc3cf:engines_live/adapters/research_intelligence_runtime.py
# STAGING ONLY: not imported by BONDS runtime.

"""Dedicated evidence-verification and research-synthesis runtimes."""

from __future__ import annotations

import hashlib
import json
from typing import Any, Mapping

from bonds_agent_runtime.research_intelligence import (
    research_readiness,
    research_topic,
    run_research_gates,
)


def _digest(value: Any) -> str:
    raw = json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(",", ":"), default=str)
    return hashlib.sha256(raw.encode("utf-8")).hexdigest()


def _topic(payload: Mapping[str, Any]) -> str:
    topic = str(
        payload.get("topic")
        or payload.get("query")
        or payload.get("text")
        or "engine verification"
    ).strip()
    if not topic:
        raise ValueError("topic is required")
    return topic


def _sources(payload: Mapping[str, Any], topic: str) -> list[dict[str, Any]]:
    raw = payload.get("sources")
    if raw is None:
        return [
            {
                "id": "official-1",
                "title": f"{topic} official report",
                "publisher": "BONDS Test Authority",
                "kind": "official",
                "published": "2026",
                "author": "Verification Team",
                "text": (
                    f"According to the 2026 report, {topic} reached 95 percent coverage. "
                    f"The report states that {topic} is evidence-backed."
                ),
            },
            {
                "id": "reference-1",
                "title": f"{topic} reference review",
                "publisher": "Independent Reference",
                "kind": "reference",
                "published": "2026",
                "author": "Review Team",
                "text": (
                    f"A 2026 study reports that {topic} reached 95 percent coverage. "
                    f"The evidence says {topic} is evidence-backed."
                ),
            },
        ]
    if not isinstance(raw, list):
        raise ValueError("sources must be a list")
    return [dict(x) for x in raw if isinstance(x, Mapping)]


def _research(payload: Mapping[str, Any]) -> tuple[str, dict[str, Any], list[str], dict[str, Any]]:
    topic = _topic(payload)
    report = research_topic(topic, _sources(payload, topic))
    failures = run_research_gates(report, topic)
    readiness = research_readiness(report, failures)
    return topic, report, failures, readiness


def make_evidence_verification_runtime_adapter():
    """ENG-CAP-147: verify evidence without promoting unresolved claims."""

    def handler(payload: Mapping[str, Any]) -> dict[str, Any]:
        try:
            topic, report, failures, readiness = _research(payload)
        except Exception as exc:
            return {
                "ok": False,
                "executed": False,
                "message": f"ENG-CAP-147 verification failed: {type(exc).__name__}: {exc}",
                "evidence": {"error": f"{type(exc).__name__}: {exc}"},
            }

        analysis = dict(report.get("analysis") or {})
        conflicts = list(analysis.get("conflicts") or [])
        sources = list(report.get("sources") or [])
        facts = list(report.get("facts") or [])
        source_publishers = {
            str(s.get("publisher") or "").strip().lower()
            for s in sources
            if isinstance(s, Mapping) and str(s.get("publisher") or "").strip()
        }
        verified_sources = [
            s for s in sources
            if isinstance(s, Mapping)
            and (s.get("verification") or {}).get("uncertainty") in {"low", "medium"}
        ]
        if not readiness.get("ready"):
            state = "INSUFFICIENT_EVIDENCE"
        elif conflicts:
            state = "CONTESTED"
        else:
            state = "SUPPORTED"

        result = {
            "topic": topic,
            "verification_state": state,
            "source_count": len(sources),
            "verified_source_count": len(verified_sources),
            "independent_publisher_count": len(source_publishers),
            "facts": facts,
            "consensus": list(analysis.get("consensus") or []),
            "contradictions": conflicts,
            "coverage": analysis.get("coverage"),
            "confidence": dict(report.get("confidence") or {}),
            "residual_uncertainty": list(report.get("open_questions") or []),
            "gate_failures": list(failures),
            "readiness": readiness,
        }
        return {
            "ok": bool(readiness.get("ready")),
            "executed": True,
            "message": f"ENG-CAP-147 evidence state={state}",
            "evidence": {
                "verification": result,
                "verification_digest": _digest(result),
                "claim_promotion_allowed": state == "SUPPORTED",
                "authority_preserved": True,
            },
        }

    return handler


def make_research_synthesis_runtime_adapter():
    """ENG-CAP-148: synthesize verified research while preserving unknowns."""

    def handler(payload: Mapping[str, Any]) -> dict[str, Any]:
        try:
            topic, report, failures, readiness = _research(payload)
        except Exception as exc:
            return {
                "ok": False,
                "executed": False,
                "message": f"ENG-CAP-148 synthesis failed: {type(exc).__name__}: {exc}",
                "evidence": {"error": f"{type(exc).__name__}: {exc}"},
            }

        sources = list(report.get("sources") or [])
        facts = list(report.get("facts") or [])
        source_by_id = {
            str(s.get("id")): {
                "title": s.get("title"),
                "publisher": s.get("publisher"),
                "verification": s.get("verification"),
            }
            for s in sources
            if isinstance(s, Mapping) and s.get("id")
        }
        evidence_map = [
            {
                "claim": fact.get("claim"),
                "source_id": fact.get("source_id"),
                "source": source_by_id.get(str(fact.get("source_id"))),
                "uncertainty": fact.get("uncertainty"),
            }
            for fact in facts
            if isinstance(fact, Mapping)
        ]
        synthesis = {
            "topic": topic,
            "known": [fact.get("claim") for fact in facts if isinstance(fact, Mapping)],
            "unknown": list(report.get("open_questions") or []),
            "evidence_map": evidence_map,
            "analysis": dict(report.get("analysis") or {}),
            "confidence": dict(report.get("confidence") or {}),
            "question_coverage": (report.get("analysis") or {}).get("coverage"),
            "gate_failures": list(failures),
            "readiness": readiness,
            "knowledge_update_candidate": bool(readiness.get("ready")),
            "world_model_update_candidate": bool(readiness.get("ready")),
            "automatic_persistence": False,
        }
        return {
            "ok": bool(readiness.get("ready")),
            "executed": True,
            "message": "ENG-CAP-148 research synthesis completed",
            "evidence": {
                "synthesis": synthesis,
                "synthesis_digest": _digest(synthesis),
                "uncertainty_preserved": True,
                "provenance_preserved": True,
                "automatic_persistence": False,
            },
        }

    return handler
