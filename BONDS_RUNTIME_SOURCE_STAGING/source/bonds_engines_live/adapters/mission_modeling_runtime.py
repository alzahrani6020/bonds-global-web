# Imported source snapshot for BONDS adaptation.
# Source: alzahrani6020/AFAQ-GIE@b1fec7fa400c57f32c2022a21cf74039379fc3cf:engines_live/adapters/mission_modeling_runtime.py
# STAGING ONLY: not imported by BONDS runtime.

"""Dedicated adaptive mission modeling runtime for ENG-CAP-136."""

from __future__ import annotations

import hashlib
import json
from typing import Any, Mapping

from bonds_agent_runtime.project_understanding import (
    run_understanding_gates,
    understand_project,
    understanding_readiness,
)


def _digest(value: Any) -> str:
    raw = json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(",", ":"), default=str)
    return hashlib.sha256(raw.encode("utf-8")).hexdigest()


def _capability_candidates(understanding: Mapping[str, Any]) -> list[dict[str, Any]]:
    intent = str((understanding.get("intent") or {}).get("kind") or "")
    hints = {str(x).lower() for x in (understanding.get("platform_hints") or [])}
    candidates: list[dict[str, Any]] = []

    def add(requirement: str, reason: str) -> None:
        if requirement not in {x["requirement"] for x in candidates}:
            candidates.append({
                "requirement": requirement,
                "reason": reason,
                "resolved_capability_id": None,
                "resolution_required": True,
            })

    if intent == "development_task":
        add("repository_understanding", "development intent requires repository context")
        add("code_intelligence", "development intent requires code-aware analysis")
        add("test_and_verification", "development outcome requires independent verification")
    elif intent == "analysis":
        add("evidence_acquisition", "analysis requires evidence acquisition")
        add("evidence_verification", "analysis requires source/claim verification")
        add("research_synthesis", "analysis requires bounded synthesis")
    else:
        add("mission_understanding", f"intent={intent or 'unknown'}")

    if "api" in hints or "web" in hints:
        add("http_or_web_runtime", "platform hints include API/web")
    if "database" in hints:
        add("storage_or_database_runtime", "platform hints include database")
    if "python" in hints:
        add("python_runtime", "platform hints include Python")
    if "node" in hints or "typescript" in hints or "react" in hints or "nextjs" in hints:
        add("node_or_typescript_runtime", "platform hints include Node/TypeScript stack")
    return candidates


def make_mission_modeling_runtime_adapter():
    """ENG-CAP-136: explicit mission model; capability resolution stays delegated."""

    def handler(payload: Mapping[str, Any]) -> dict[str, Any]:
        try:
            instruction = str(
                payload.get("instruction")
                or payload.get("text")
                or "I want to build a verified internal report for the technical team."
            ).strip()
            if not instruction:
                raise ValueError("instruction is required")
            repo_map = payload.get("repo_map")
            if repo_map is not None and not isinstance(repo_map, Mapping):
                raise ValueError("repo_map must be an object")

            understanding = understand_project(
                instruction,
                repo_map if isinstance(repo_map, Mapping) else None,
            )
            gate_failures = run_understanding_gates(
                understanding,
                instruction,
            )
            readiness = understanding_readiness(
                understanding,
                gate_failures,
            )

            capability_candidates = _capability_candidates(understanding)
            environment_requirements = [
                {
                    "platform_hint": hint,
                    "verification_state": "CANDIDATE",
                }
                for hint in understanding.get("platform_hints") or []
            ]
            success_criteria = [
                {
                    "criterion": f"Goal satisfied: {goal}",
                    "evidence_required": True,
                }
                for goal in understanding.get("goals") or []
            ]
            success_criteria.extend(
                {
                    "criterion": f"Deliverable produced and verified: {item}",
                    "evidence_required": True,
                }
                for item in understanding.get("deliverables") or []
            )
            success_criteria.append({
                "criterion": "Mission verification gates pass",
                "evidence_required": True,
            })

            open_questions = list(understanding.get("open_questions") or [])
            information_needs = [
                {
                    "question": question,
                    "state": "OPEN",
                    "resolution_required": True,
                }
                for question in open_questions
            ]
            mission = {
                "instruction": instruction,
                "intent": understanding.get("intent"),
                "goals": list(understanding.get("goals") or []),
                "constraints": list(understanding.get("constraints") or []),
                "deliverables": list(understanding.get("deliverables") or []),
                "audience": understanding.get("audience"),
                "decomposition": list(understanding.get("decomposition") or []),
                "environment_requirements": environment_requirements,
                "capability_requirement_candidates": capability_candidates,
                "capability_resolution_delegated_to": "ENG-CAP-005",
                "success_criteria_candidates": success_criteria,
                "information_needs": information_needs,
                "unknown_requirements_detected": bool(open_questions),
                "understanding_confidence": understanding.get("confidence"),
                "understanding_readiness": readiness,
                "gate_failures": gate_failures,
                "context_refresh_supported": True,
                "automatic_goal_activation": False,
                "automatic_capability_binding": False,
                "authority_created": False,
            }
            ok = bool(readiness.get("ready"))
            return {
                "ok": ok,
                "executed": True,
                "message": (
                    "ENG-CAP-136 mission model ready"
                    if ok
                    else "ENG-CAP-136 mission model requires clarification"
                ),
                "evidence": {
                    "mission_model": mission,
                    "mission_model_digest": _digest(mission),
                    "unknowns_preserved": True,
                    "capability_ids_not_invented": True,
                    "authority_preserved": True,
                },
            }
        except Exception as exc:
            return {
                "ok": False,
                "executed": False,
                "message": f"ENG-CAP-136 mission modeling blocked: {type(exc).__name__}: {exc}",
                "evidence": {
                    "error": f"{type(exc).__name__}: {exc}",
                    "fail_closed": True,
                },
            }

    return handler
