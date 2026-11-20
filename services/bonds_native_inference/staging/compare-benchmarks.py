#!/usr/bin/env python3
"""Compare repeated, warm, like-for-like llama-server inference benchmarks.

Input files are JSONL output from staging/benchmark.ps1; no production changes.
"""
from __future__ import annotations

import argparse
import json
import math
import statistics
from pathlib import Path


def load(path: Path) -> list[dict]:
    rows = [json.loads(line) for line in path.read_text(encoding="utf-8-sig").splitlines() if line.strip()]
    if not rows:
        raise ValueError(f"{path}: no results")
    selected = [r for r in rows if not r.get("warmup", False)]
    if len(selected) < 5:
        raise ValueError(f"{path}: need at least five non-warmup runs")
    if any(not r.get("success") or r.get("error") for r in selected):
        raise ValueError(f"{path}: an included run failed")
    for r in selected:
        if (not isinstance(r.get("elapsed_s"), (int, float))
                or not math.isfinite(r["elapsed_s"]) or r["elapsed_s"] <= 0):
            raise ValueError(f"{path}: invalid elapsed_s")
        if (not isinstance(r.get("completion_tokens"), int)
                or isinstance(r["completion_tokens"], bool)
                or r["completion_tokens"] <= 0):
            raise ValueError(f"{path}: missing/invalid completion_tokens")
        if (not isinstance(r.get("prompt_tokens"), int)
                or isinstance(r["prompt_tokens"], bool)
                or r["prompt_tokens"] < 0):
            raise ValueError(f"{path}: missing/invalid prompt_tokens")
    prompts = {r["prompt_tokens"] for r in selected}
    if len(prompts) != 1:
        raise ValueError(f"{path}: varying prompt token counts; keep payload fixed")
    return selected


def metrics(rows: list[dict]) -> dict:
    elapsed = [r["elapsed_s"] for r in rows]
    throughput = [r["completion_tokens"] / r["elapsed_s"] for r in rows]
    return {
        "runs": len(rows),
        "median_elapsed_s": statistics.median(elapsed),
        "median_effective_tokens_per_s": statistics.median(throughput),
        "min_completion_tokens": min(r["completion_tokens"] for r in rows),
        "max_completion_tokens": max(r["completion_tokens"] for r in rows),
    }


def main() -> int:
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument("baseline", type=Path)
    p.add_argument("candidate", type=Path)
    p.add_argument("--minimum-speedup-pct", type=float, default=10.0)
    args = p.parse_args()
    baseline, candidate = load(args.baseline), load(args.candidate)
    if len(baseline) != len(candidate):
        raise ValueError("baseline and candidate require equal run counts")
    if baseline[0]["prompt_tokens"] != candidate[0]["prompt_tokens"]:
        raise ValueError("baseline and candidate have different prompt token counts")
    # Token counts can differ across responses even with the same payload. Total
    # latency must not be compared as though the output lengths are identical.
    b, c = metrics(baseline), metrics(candidate)
    length_ratio = c["max_completion_tokens"] / b["min_completion_tokens"]
    opposite_ratio = b["max_completion_tokens"] / c["min_completion_tokens"]
    if max(length_ratio, opposite_ratio) > 1.10:
        raise ValueError("completion token counts differ by >10%; cannot compare latency fairly")
    speedup_pct = 100.0 * (c["median_effective_tokens_per_s"] / b["median_effective_tokens_per_s"] - 1.0)
    result = {
        "status": "PASS" if speedup_pct >= args.minimum_speedup_pct else "FAIL",
        "baseline": b,
        "candidate": c,
        "median_throughput_improvement_pct": round(speedup_pct, 2),
        "minimum_speedup_pct": args.minimum_speedup_pct,
        "note": "HTTP elapsed/token is effective throughput, not model-only decode speed. Use identical payload, host, model, warmups, and independent repetitions.",
    }
    print(json.dumps(result, ensure_ascii=False, indent=2))
    return 0 if result["status"] == "PASS" else 1


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except (ValueError, OSError, json.JSONDecodeError) as exc:
        print(json.dumps({"status": "UNKNOWN", "reason": str(exc)}))
        raise SystemExit(2)
