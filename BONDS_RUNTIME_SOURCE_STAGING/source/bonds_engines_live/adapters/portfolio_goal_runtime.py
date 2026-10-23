# Imported source snapshot for BONDS adaptation.
# Source: alzahrani6020/AFAQ-GIE@b1fec7fa400c57f32c2022a21cf74039379fc3cf:engines_live/adapters/portfolio_goal_runtime.py
# STAGING ONLY: not imported by BONDS runtime.

"""Dedicated research-portfolio and goal-formation runtimes for ENG-CAP-156/157."""

from __future__ import annotations

import hashlib
import json
from collections import defaultdict
from typing import Any, Mapping


_OPPORTUNITY_TYPES = {
    "internal_improvement",
    "external_client",
    "research",
    "product",
    "service",
    "licensing",
    "partnership",
    "commercialization",
    "noncommercial_benefit",
}


def _digest(value: Any) -> str:
    raw = json.dumps(
        value,
        ensure_ascii=False,
        sort_keys=True,
        separators=(",", ":"),
        default=str,
    )
    return hashlib.sha256(raw.encode("utf-8")).hexdigest()


def _score(value: Any, name: str) -> float:
    if isinstance(value, bool):
        raise ValueError(f"{name} must be numeric")
    try:
        out = float(value)
    except (TypeError, ValueError) as exc:
        raise ValueError(f"{name} must be numeric") from exc
    if not 0.0 <= out <= 1.0:
        raise ValueError(f"{name} must be between 0 and 1")
    return out


def _mission(raw: Mapping[str, Any], index: int) -> dict[str, Any]:
    mission_id = str(raw.get("mission_id") or f"mission-{index+1}").strip()
    question = str(raw.get("question") or "").strip()
    if not question:
        raise ValueError("research mission requires question")
    evidence_requirements = [
        str(x).strip()
        for x in (raw.get("evidence_requirements") or [])
        if str(x).strip()
    ]
    if not evidence_requirements:
        raise ValueError("research mission requires evidence_requirements")
    collection_plan = [
        str(x).strip()
        for x in (raw.get("collection_plan") or [])
        if str(x).strip()
    ]
    if not collection_plan:
        raise ValueError("research mission requires collection_plan")
    sources = [
        str(x).strip()
        for x in (raw.get("source_strategy") or [])
        if str(x).strip()
    ]
    if not sources:
        raise ValueError("research mission requires source_strategy")

    impact = _score(raw.get("impact", 0.5), "impact")
    urgency = _score(raw.get("urgency", 0.5), "urgency")
    uncertainty = _score(raw.get("uncertainty", 0.5), "uncertainty")
    strategic_relevance = _score(
        raw.get("strategic_relevance", 0.5), "strategic_relevance"
    )
    priority = round(
        0.35 * impact
        + 0.25 * urgency
        + 0.20 * uncertainty
        + 0.20 * strategic_relevance,
        6,
    )

    evidence_refs = sorted({
        str(x) for x in (raw.get("evidence_refs") or []) if str(x).strip()
    })
    open_questions = [
        str(x).strip()
        for x in (raw.get("open_questions") or [])
        if str(x).strip()
    ]
    blind_spots = [
        str(x).strip()
        for x in (raw.get("blind_spots") or [])
        if str(x).strip()
    ]
    completed_requirements = sorted({
        str(x).strip()
        for x in (raw.get("completed_evidence_requirements") or [])
        if str(x).strip()
    })
    evidence_coverage = round(
        len(set(completed_requirements) & set(evidence_requirements))
        / len(evidence_requirements),
        6,
    )
    stop_conditions = {
        "minimum_evidence_coverage": _score(
            raw.get("minimum_evidence_coverage", 1.0),
            "minimum_evidence_coverage",
        ),
        "require_no_open_questions": bool(
            raw.get("require_no_open_questions", False)
        ),
    }
    stop_reached = (
        evidence_coverage >= stop_conditions["minimum_evidence_coverage"]
        and (
            not stop_conditions["require_no_open_questions"]
            or not open_questions
        )
    )
    status = "COMPLETE" if stop_reached else "IN_PROGRESS"
    row = {
        "mission_id": mission_id,
        "question": question,
        "priority_score": priority,
        "priority_inputs": {
            "impact": impact,
            "urgency": urgency,
            "uncertainty": uncertainty,
            "strategic_relevance": strategic_relevance,
        },
        "collection_plan": collection_plan,
        "source_strategy": sources,
        "evidence_requirements": evidence_requirements,
        "completed_evidence_requirements": completed_requirements,
        "evidence_coverage": evidence_coverage,
        "evidence_refs": evidence_refs,
        "open_questions": open_questions,
        "blind_spots": blind_spots,
        "stop_conditions": stop_conditions,
        "stop_reached": stop_reached,
        "status": status,
        "version": str(raw.get("version") or "v1"),
        "knowledge_update_candidate": status == "COMPLETE" and bool(evidence_refs),
        "capability_candidate": bool(raw.get("capability_gap_candidate", False)),
        "automatic_knowledge_write": False,
        "automatic_capability_registration": False,
    }
    row["study_digest"] = _digest(row)
    return row


def make_research_portfolio_runtime_adapter():
    """ENG-CAP-156: coordinate reproducible research missions and studies."""

    def handler(payload: Mapping[str, Any]) -> dict[str, Any]:
        try:
            raw = payload.get("missions")
            if raw is None:
                raw = [{
                    "mission_id": "probe-study-1",
                    "question": "What changed in the verified capability landscape?",
                    "impact": 0.8,
                    "urgency": 0.6,
                    "uncertainty": 0.7,
                    "strategic_relevance": 0.9,
                    "evidence_requirements": ["source", "corroboration"],
                    "completed_evidence_requirements": ["source"],
                    "collection_plan": ["observe", "verify", "synthesize"],
                    "source_strategy": ["official", "reference"],
                    "evidence_refs": ["probe:study:source"],
                    "open_questions": ["corroboration pending"],
                    "blind_spots": ["unobserved providers"],
                    "minimum_evidence_coverage": 1.0,
                }]
            if not isinstance(raw, list) or not raw:
                raise ValueError("missions must be a non-empty list")
            missions = [
                _mission(item, index)
                for index, item in enumerate(raw)
                if isinstance(item, Mapping)
            ]
            if not missions:
                raise ValueError("no valid research missions")
            missions.sort(
                key=lambda x: (-x["priority_score"], x["mission_id"])
            )
            report = {
                "missions": missions,
                "priority_order": [x["mission_id"] for x in missions],
                "open_question_registry": [
                    {
                        "mission_id": x["mission_id"],
                        "questions": x["open_questions"],
                    }
                    for x in missions
                    if x["open_questions"]
                ],
                "blind_spot_registry": [
                    {
                        "mission_id": x["mission_id"],
                        "blind_spots": x["blind_spots"],
                    }
                    for x in missions
                    if x["blind_spots"]
                ],
                "knowledge_update_candidates": [
                    x["mission_id"]
                    for x in missions
                    if x["knowledge_update_candidate"]
                ],
                "capability_candidates": [
                    x["mission_id"] for x in missions if x["capability_candidate"]
                ],
                "automatic_knowledge_write": False,
                "automatic_capability_registration": False,
                "authority_created": False,
            }
            return {
                "ok": True,
                "executed": True,
                "message": f"ENG-CAP-156 coordinated {len(missions)} research missions",
                "evidence": {
                    "portfolio": report,
                    "portfolio_digest": _digest(report),
                    "reproducible": True,
                    "authority_preserved": True,
                },
            }
        except Exception as exc:
            return {
                "ok": False,
                "executed": False,
                "message": f"ENG-CAP-156 portfolio blocked: {type(exc).__name__}: {exc}",
                "evidence": {
                    "error": f"{type(exc).__name__}: {exc}",
                    "fail_closed": True,
                },
            }

    return handler


def _insight(raw: Mapping[str, Any], index: int) -> dict[str, Any]:
    insight_id = str(raw.get("insight_id") or f"insight-{index+1}").strip()
    statement = str(raw.get("statement") or "").strip()
    if not statement:
        raise ValueError("insight requires statement")
    evidence_refs = sorted({
        str(x) for x in (raw.get("evidence_refs") or []) if str(x).strip()
    })
    if not evidence_refs:
        raise ValueError("insight requires evidence_refs")
    confidence = _score(raw.get("confidence", 0.5), "confidence")
    opportunity_type = str(
        raw.get("opportunity_type") or "internal_improvement"
    ).strip()
    if opportunity_type not in _OPPORTUNITY_TYPES:
        raise ValueError("unsupported opportunity_type")
    return {
        "insight_id": insight_id,
        "statement": statement,
        "evidence_refs": evidence_refs,
        "confidence": confidence,
        "opportunity_type": opportunity_type,
    }


def _proposal_templates(insight: dict[str, Any]) -> list[dict[str, Any]]:
    """Generate transparent policy alternatives; scores are heuristics, not facts."""
    base = insight["confidence"]
    templates = (
        (
            "PILOT",
            {
                "value": 0.75 * base + 0.10,
                "feasibility": 0.85,
                "cost_efficiency": 0.75,
                "time_efficiency": 0.80,
                "resource_efficiency": 0.80,
                "risk_control": 0.85,
            },
            "Run a bounded pilot with explicit success and stop criteria.",
        ),
        (
            "SCALE",
            {
                "value": 0.90 * base + 0.05,
                "feasibility": 0.65,
                "cost_efficiency": 0.45,
                "time_efficiency": 0.50,
                "resource_efficiency": 0.50,
                "risk_control": 0.55,
            },
            "Prepare a broader implementation candidate after pilot-grade evidence.",
        ),
        (
            "RESEARCH",
            {
                "value": 0.55 * base + 0.05,
                "feasibility": 0.95,
                "cost_efficiency": 0.90,
                "time_efficiency": 0.85,
                "resource_efficiency": 0.90,
                "risk_control": 0.95,
            },
            "Collect additional evidence before implementation commitment.",
        ),
    )
    proposals = []
    for mode, metrics, action in templates:
        bounded = {k: round(min(1.0, max(0.0, v)), 6) for k, v in metrics.items()}
        score = round(sum(bounded.values()) / len(bounded), 6)
        proposal_id = f"{insight['insight_id']}:{mode.lower()}"
        proposals.append({
            "proposal_id": proposal_id,
            "insight_id": insight["insight_id"],
            "mode": mode,
            "action": action,
            "opportunity_type": insight["opportunity_type"],
            "metrics": bounded,
            "priority_score": score,
            "assumptions": [
                "heuristic scores are policy estimates, not observed facts",
                "execution requires separate authority and verification",
            ],
            "dependencies": ["verified evidence package"],
            "risks": [
                "evidence may be incomplete",
                "outcomes may differ from heuristic ranking",
            ],
            "counterargument": (
                "No-change or additional research may dominate if evidence weakens."
            ),
            "evidence_refs": list(insight["evidence_refs"]),
            "scoring_basis": "TRANSPARENT_HEURISTIC_POLICY_V1",
            "automatic_execution": False,
        })
    return proposals


def make_goal_formation_runtime_adapter():
    """ENG-CAP-157: form evidence-linked proposal and goal candidates."""

    def handler(payload: Mapping[str, Any]) -> dict[str, Any]:
        try:
            raw = payload.get("insights")
            if raw is None:
                raw = [{
                    "insight_id": "probe-insight-1",
                    "statement": "Verified evidence indicates an improvement opportunity.",
                    "evidence_refs": ["probe:insight:1"],
                    "confidence": 0.8,
                    "opportunity_type": "internal_improvement",
                }]
            if not isinstance(raw, list) or not raw:
                raise ValueError("insights must be a non-empty list")
            insights = [
                _insight(item, index)
                for index, item in enumerate(raw)
                if isinstance(item, Mapping)
            ]
            if not insights:
                raise ValueError("no valid insights")

            proposals = [
                proposal
                for insight in insights
                for proposal in _proposal_templates(insight)
            ]
            # Deduplicate on mode + normalized action per insight.
            seen: set[str] = set()
            deduped = []
            for proposal in proposals:
                key = _digest({
                    "insight_id": proposal["insight_id"],
                    "mode": proposal["mode"],
                    "action": proposal["action"],
                })
                if key in seen:
                    continue
                seen.add(key)
                proposal["lineage_digest"] = key
                deduped.append(proposal)

            deduped.sort(
                key=lambda x: (-x["priority_score"], x["proposal_id"])
            )

            # Pareto frontier: proposal is dominated only when another is
            # >= on every metric and > on at least one.
            frontier = []
            for proposal in deduped:
                m = proposal["metrics"]
                dominated = False
                for other in deduped:
                    if other is proposal or other["insight_id"] != proposal["insight_id"]:
                        continue
                    om = other["metrics"]
                    if all(om[k] >= m[k] for k in m) and any(
                        om[k] > m[k] for k in m
                    ):
                        dominated = True
                        break
                if not dominated:
                    frontier.append(proposal)

            clusters: dict[str, list[str]] = defaultdict(list)
            for proposal in deduped:
                clusters[proposal["opportunity_type"]].append(
                    proposal["proposal_id"]
                )

            goals = []
            for proposal in frontier:
                if proposal["mode"] == "RESEARCH":
                    success = [
                        "required evidence package completed",
                        "open uncertainties reduced or explicitly bounded",
                    ]
                elif proposal["mode"] == "PILOT":
                    success = [
                        "pilot acceptance criteria pass",
                        "no blocking safety or governance finding",
                        "measured result independently verified",
                    ]
                else:
                    success = [
                        "pilot-grade evidence exists",
                        "production admission gates pass",
                        "owner authority explicitly granted",
                    ]
                goals.append({
                    "goal_id": f"goal:{proposal['proposal_id']}",
                    "proposal_id": proposal["proposal_id"],
                    "opportunity_type": proposal["opportunity_type"],
                    "success_criteria": success,
                    "evidence_package": proposal["evidence_refs"],
                    "priority_score": proposal["priority_score"],
                    "handoff_state": "CANDIDATE_ONLY",
                    "automatic_execution": False,
                    "owner_authority_required": True,
                })

            report = {
                "insights": insights,
                "proposals": deduped,
                "pareto_frontier": [p["proposal_id"] for p in frontier],
                "proposal_clusters": dict(sorted(clusters.items())),
                "rejected_proposals": [
                    {
                        "proposal_id": p["proposal_id"],
                        "reason": "PARETO_DOMINATED",
                    }
                    for p in deduped
                    if p not in frontier
                ],
                "goal_candidates": goals,
                "continuous_reassessment_input_digest": _digest(insights),
                "automatic_goal_activation": False,
                "automatic_execution": False,
                "authority_created": False,
            }
            return {
                "ok": True,
                "executed": True,
                "message": f"ENG-CAP-157 formed {len(goals)} goal candidates",
                "evidence": {
                    "goal_formation": report,
                    "goal_formation_digest": _digest(report),
                    "heuristics_disclosed": True,
                    "evidence_linked": True,
                    "authority_preserved": True,
                },
            }
        except Exception as exc:
            return {
                "ok": False,
                "executed": False,
                "message": f"ENG-CAP-157 goal formation blocked: {type(exc).__name__}: {exc}",
                "evidence": {
                    "error": f"{type(exc).__name__}: {exc}",
                    "fail_closed": True,
                },
            }

    return handler
