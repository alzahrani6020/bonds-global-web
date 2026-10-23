# Imported source snapshot for BONDS adaptation.
# Source: alzahrani6020/AFAQ-GIE@b1fec7fa400c57f32c2022a21cf74039379fc3cf:engines_live/adapters/causal_forecast_runtime.py
# STAGING ONLY: not imported by BONDS runtime.

"""Dedicated falsification/causal and scenario-forecast runtimes."""

from __future__ import annotations

import hashlib
import json
import math
from typing import Any, Mapping


def _digest(value: Any) -> str:
    raw = json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(",", ":"), default=str)
    return hashlib.sha256(raw.encode("utf-8")).hexdigest()


def _bounded(value: Any, name: str, *, lo: float = 0.0, hi: float = 1.0) -> float:
    if isinstance(value, bool):
        raise ValueError(f"{name} must be numeric")
    try:
        out = float(value)
    except (TypeError, ValueError) as exc:
        raise ValueError(f"{name} must be numeric") from exc
    if not lo <= out <= hi:
        raise ValueError(f"{name} must be between {lo} and {hi}")
    return out


def make_falsification_causal_runtime_adapter():
    """ENG-CAP-149: compare competing hypotheses and preserve unresolved ones."""

    def handler(payload: Mapping[str, Any]) -> dict[str, Any]:
        try:
            raw = payload.get("hypotheses")
            if raw is None:
                raw = [
                    {
                        "hypothesis_id": "h-direct",
                        "statement": "The observed outcome is caused by the proposed factor.",
                        "evidence_for": ["probe:evidence:for"],
                        "evidence_against": [],
                        "predictions": ["outcome changes when factor changes"],
                        "confounders": ["unobserved external factor"],
                    },
                    {
                        "hypothesis_id": "h-confounded",
                        "statement": "The association is explained by a confounding factor.",
                        "evidence_for": [],
                        "evidence_against": ["probe:evidence:against"],
                        "predictions": ["association weakens after confounder control"],
                        "confounders": ["shared upstream cause"],
                    },
                ]
            if not isinstance(raw, list) or len(raw) < 2:
                raise ValueError("at least two competing hypotheses are required")

            normalized = []
            for index, item in enumerate(raw):
                if not isinstance(item, Mapping):
                    raise ValueError("hypothesis must be an object")
                hid = str(item.get("hypothesis_id") or f"h-{index+1}").strip()
                statement = str(item.get("statement") or "").strip()
                if not statement:
                    raise ValueError("hypothesis statement is required")
                evidence_for = sorted({
                    str(x) for x in (item.get("evidence_for") or []) if str(x).strip()
                })
                evidence_against = sorted({
                    str(x) for x in (item.get("evidence_against") or []) if str(x).strip()
                })
                predictions = [
                    str(x).strip() for x in (item.get("predictions") or [])
                    if str(x).strip()
                ]
                if not predictions:
                    raise ValueError("hypothesis requires falsifiable predictions")
                confounders = [
                    str(x).strip() for x in (item.get("confounders") or [])
                    if str(x).strip()
                ]
                support = len(evidence_for)
                challenge = len(evidence_against)
                evidence_total = support + challenge
                evidence_balance = (
                    round((support - challenge) / evidence_total, 6)
                    if evidence_total else 0.0
                )
                uncertainty = round(
                    1.0 / (1.0 + evidence_total)
                    + min(0.4, 0.1 * len(confounders)),
                    6,
                )
                uncertainty = min(1.0, uncertainty)
                score = round(
                    0.5
                    + 0.35 * evidence_balance
                    - 0.15 * uncertainty,
                    6,
                )
                score = min(1.0, max(0.0, score))
                tests = [
                    {
                        "prediction": prediction,
                        "test": (
                            "Seek evidence that would contradict this prediction "
                            "before increasing confidence."
                        ),
                    }
                    for prediction in predictions
                ]
                row = {
                    "hypothesis_id": hid,
                    "statement": statement,
                    "evidence_for": evidence_for,
                    "evidence_against": evidence_against,
                    "predictions": predictions,
                    "falsification_tests": tests,
                    "confounders": confounders,
                    "support_score": score,
                    "uncertainty": uncertainty,
                    "causal_status": (
                        "SUPPORTED_CANDIDATE"
                        if score >= 0.7 and evidence_for
                        else "CHALLENGED"
                        if score <= 0.3 and evidence_against
                        else "UNRESOLVED"
                    ),
                }
                row["hypothesis_digest"] = _digest(row)
                normalized.append(row)

            normalized.sort(
                key=lambda x: (-x["support_score"], x["hypothesis_id"])
            )
            causal_graph = payload.get("causal_graph") or []
            if not isinstance(causal_graph, list):
                raise ValueError("causal_graph must be a list")
            counterfactuals = [
                {
                    "hypothesis_id": row["hypothesis_id"],
                    "question": (
                        "Would the outcome still be expected if the proposed cause "
                        "were absent while confounders remained?"
                    ),
                    "status": "TEST_REQUIRED",
                }
                for row in normalized
            ]
            report = {
                "ranked_hypotheses": normalized,
                "causal_graph": causal_graph,
                "counterfactuals": counterfactuals,
                "unresolved_hypotheses": [
                    row["hypothesis_id"]
                    for row in normalized
                    if row["causal_status"] == "UNRESOLVED"
                ],
                "correlation_is_not_causation": True,
                "automatic_causal_claim": False,
                "authority_created": False,
            }
            return {
                "ok": True,
                "executed": True,
                "message": f"ENG-CAP-149 analyzed {len(normalized)} competing hypotheses",
                "evidence": {
                    "falsification": report,
                    "falsification_digest": _digest(report),
                    "uncertainty_preserved": True,
                    "authority_preserved": True,
                },
            }
        except Exception as exc:
            return {
                "ok": False,
                "executed": False,
                "message": f"ENG-CAP-149 falsification blocked: {type(exc).__name__}: {exc}",
                "evidence": {"error": f"{type(exc).__name__}: {exc}", "fail_closed": True},
            }

    return handler


def _scenario_value(base: float, delta: float, sensitivity: float) -> float:
    return round(base * (1.0 + delta * sensitivity), 6)


def make_scenario_forecast_runtime_adapter():
    """ENG-CAP-150: explicit-assumption scenario forecast with backtesting."""

    def handler(payload: Mapping[str, Any]) -> dict[str, Any]:
        try:
            base = float(payload.get("baseline") if payload.get("baseline") is not None else 100.0)
            if not math.isfinite(base):
                raise ValueError("baseline must be finite")
            uncertainty = _bounded(
                payload.get("uncertainty", 0.20),
                "uncertainty",
                lo=0.0,
                hi=1.0,
            )
            sensitivity = _bounded(
                payload.get("sensitivity", 1.0),
                "sensitivity",
                lo=0.0,
                hi=5.0,
            )
            assumptions_raw = payload.get("assumptions")
            if assumptions_raw is None:
                assumptions_raw = [
                    "baseline is representative of the current state",
                    "scenario deltas are analytical assumptions, not observed facts",
                ]
            assumptions = [
                str(x).strip() for x in assumptions_raw if str(x).strip()
            ]
            if not assumptions:
                raise ValueError("at least one assumption is required")

            scenarios = [
                {
                    "scenario": "BASE",
                    "delta": 0.0,
                    "forecast": round(base, 6),
                },
                {
                    "scenario": "UPSIDE",
                    "delta": uncertainty,
                    "forecast": _scenario_value(base, uncertainty, sensitivity),
                },
                {
                    "scenario": "DOWNSIDE",
                    "delta": -uncertainty,
                    "forecast": _scenario_value(base, -uncertainty, sensitivity),
                },
                {
                    "scenario": "STRESS",
                    "delta": -min(1.0, uncertainty * 2.0),
                    "forecast": _scenario_value(
                        base,
                        -min(1.0, uncertainty * 2.0),
                        sensitivity,
                    ),
                },
            ]
            low = min(x["forecast"] for x in scenarios)
            high = max(x["forecast"] for x in scenarios)
            actual = payload.get("actual")
            backtest = None
            if actual is not None:
                actual_f = float(actual)
                if not math.isfinite(actual_f):
                    raise ValueError("actual must be finite")
                error = round(actual_f - base, 6)
                absolute_percentage_error = (
                    round(abs(error) / abs(actual_f), 6)
                    if actual_f != 0 else None
                )
                backtest = {
                    "actual": actual_f,
                    "base_forecast": round(base, 6),
                    "error": error,
                    "absolute_percentage_error": absolute_percentage_error,
                    "inside_scenario_interval": low <= actual_f <= high,
                }

            sensitivity_cases = [
                {
                    "sensitivity": round(s, 3),
                    "upside": _scenario_value(base, uncertainty, s),
                    "downside": _scenario_value(base, -uncertainty, s),
                }
                for s in sorted({0.5, 1.0, sensitivity, min(5.0, sensitivity * 1.5)})
            ]
            report = {
                "baseline": round(base, 6),
                "assumptions": assumptions,
                "uncertainty": uncertainty,
                "confidence_interval": {"low": low, "high": high},
                "scenarios": scenarios,
                "sensitivity_analysis": sensitivity_cases,
                "backtest": backtest,
                "calibration_candidate": backtest is not None,
                "forecast_vs_actual_reconciliation": backtest,
                "forecast_is_not_fact": True,
                "automatic_decision": False,
                "authority_created": False,
            }
            return {
                "ok": True,
                "executed": True,
                "message": "ENG-CAP-150 scenario forecast completed",
                "evidence": {
                    "forecast": report,
                    "forecast_digest": _digest(report),
                    "assumptions_explicit": True,
                    "uncertainty_explicit": True,
                    "authority_preserved": True,
                },
            }
        except Exception as exc:
            return {
                "ok": False,
                "executed": False,
                "message": f"ENG-CAP-150 forecast blocked: {type(exc).__name__}: {exc}",
                "evidence": {"error": f"{type(exc).__name__}: {exc}", "fail_closed": True},
            }

    return handler
