# Imported source snapshot for BONDS adaptation.
# Source: alzahrani6020/AFAQ-GIE@b1fec7fa400c57f32c2022a21cf74039379fc3cf:web_acquisition/benchmark.py
# STAGING ONLY: not imported by BONDS runtime.

"""Reproducible behavioral benchmark harness for external/internal capability comparison."""

from __future__ import annotations

import hashlib
import json
import statistics
import time
from dataclasses import dataclass
from typing import Any, Callable, Mapping


Executor = Callable[[Mapping[str, Any]], Mapping[str, Any]]


def _digest(value: Any) -> str:
    raw = json.dumps(value, sort_keys=True, default=str, separators=(",", ":"))
    return hashlib.sha256(raw.encode("utf-8")).hexdigest()


@dataclass(frozen=True)
class BenchmarkCaseResult:
    case_id: str
    baseline_ok: bool
    candidate_ok: bool
    baseline_ms: float
    candidate_ms: float
    baseline_digest: str
    candidate_digest: str
    output_equal: bool

    def as_dict(self) -> dict[str, Any]:
        return {
            "case_id": self.case_id,
            "baseline_ok": self.baseline_ok,
            "candidate_ok": self.candidate_ok,
            "baseline_ms": self.baseline_ms,
            "candidate_ms": self.candidate_ms,
            "baseline_digest": self.baseline_digest,
            "candidate_digest": self.candidate_digest,
            "output_equal": self.output_equal,
        }


@dataclass(frozen=True)
class BenchmarkReport:
    state: str
    cases: tuple[BenchmarkCaseResult, ...]
    baseline_success_rate: float
    candidate_success_rate: float
    baseline_median_ms: float
    candidate_median_ms: float
    equivalence_rate: float
    evidence_refs: tuple[str, ...]

    def as_dict(self) -> dict[str, Any]:
        return {
            "state": self.state,
            "cases": [case.as_dict() for case in self.cases],
            "baseline_success_rate": self.baseline_success_rate,
            "candidate_success_rate": self.candidate_success_rate,
            "baseline_median_ms": self.baseline_median_ms,
            "candidate_median_ms": self.candidate_median_ms,
            "equivalence_rate": self.equivalence_rate,
            "evidence_refs": list(self.evidence_refs),
        }


def _run(executor: Executor, payload: Mapping[str, Any]) -> tuple[dict[str, Any], float]:
    started = time.perf_counter()
    try:
        result = dict(executor(dict(payload)))
    except Exception as exc:  # noqa: BLE001
        result = {"ok": False, "error_class": type(exc).__name__}
    elapsed = round((time.perf_counter() - started) * 1000, 3)
    return result, elapsed


def benchmark_pair(
    *,
    baseline: Executor,
    candidate: Executor,
    cases: tuple[Mapping[str, Any], ...],
    evidence_refs: tuple[str, ...] = (),
) -> BenchmarkReport:
    if not cases:
        raise ValueError("benchmark requires at least one case")

    results: list[BenchmarkCaseResult] = []
    for index, payload in enumerate(cases):
        baseline_result, baseline_ms = _run(baseline, payload)
        candidate_result, candidate_ms = _run(candidate, payload)
        results.append(
            BenchmarkCaseResult(
                case_id=str(payload.get("case_id") or f"case-{index + 1}"),
                baseline_ok=bool(baseline_result.get("ok")),
                candidate_ok=bool(candidate_result.get("ok")),
                baseline_ms=baseline_ms,
                candidate_ms=candidate_ms,
                baseline_digest=_digest(baseline_result),
                candidate_digest=_digest(candidate_result),
                output_equal=baseline_result == candidate_result,
            )
        )

    n = len(results)
    baseline_success = round(sum(item.baseline_ok for item in results) / n, 6)
    candidate_success = round(sum(item.candidate_ok for item in results) / n, 6)
    equivalence = round(sum(item.output_equal for item in results) / n, 6)
    if candidate_success > baseline_success:
        state = "CANDIDATE_BETTER_SUCCESS_RATE"
    elif candidate_success < baseline_success:
        state = "CANDIDATE_WORSE_SUCCESS_RATE"
    elif equivalence == 1.0:
        state = "BEHAVIORALLY_EQUIVALENT_ON_BENCHMARK"
    else:
        state = "MIXED_OR_NON_EQUIVALENT"

    return BenchmarkReport(
        state=state,
        cases=tuple(results),
        baseline_success_rate=baseline_success,
        candidate_success_rate=candidate_success,
        baseline_median_ms=round(statistics.median(item.baseline_ms for item in results), 3),
        candidate_median_ms=round(statistics.median(item.candidate_ms for item in results), 3),
        equivalence_rate=equivalence,
        evidence_refs=evidence_refs,
    )
