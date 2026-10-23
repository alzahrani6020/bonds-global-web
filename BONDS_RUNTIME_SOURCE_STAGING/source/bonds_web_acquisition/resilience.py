# Imported source snapshot for BONDS adaptation.
# Source: alzahrani6020/AFAQ-GIE@b1fec7fa400c57f32c2022a21cf74039379fc3cf:web_acquisition/resilience.py
# STAGING ONLY: not imported by BONDS runtime.

"""Bounded acquisition retry and recovery policies."""

from __future__ import annotations

import time
from dataclasses import dataclass
from typing import Any

from .contracts import FetchResult
from .fetch import fetch_url


_RETRYABLE = {
    "HTTP_429",
    "HTTP_5XX",
    "CONNECT_OR_DNS_FAILURE",
    "CONNECT_TIMEOUT",
    "READ_TIMEOUT",
}


@dataclass(frozen=True)
class RetryPolicy:
    max_attempts: int = 3
    base_delay_seconds: float = 0.25
    max_delay_seconds: float = 2.0

    def __post_init__(self) -> None:
        if self.max_attempts <= 0 or self.max_attempts > 8:
            raise ValueError("max_attempts must be 1..8")
        if self.base_delay_seconds < 0 or self.max_delay_seconds < 0:
            raise ValueError("retry delays must be non-negative")


@dataclass(frozen=True)
class ResilientFetchResult:
    result: FetchResult
    attempts: int
    recovery_trace: tuple[dict[str, Any], ...]

    def as_dict(self) -> dict[str, Any]:
        return {
            "attempts": self.attempts,
            "recovery_trace": list(self.recovery_trace),
            "final": self.result.evidence.as_dict(),
            "ok": self.result.ok,
            "executed": self.result.executed,
        }


def fetch_resilient(
    url: str,
    *,
    policy: RetryPolicy | None = None,
    **kwargs: Any,
) -> ResilientFetchResult:
    config = policy or RetryPolicy()
    trace: list[dict[str, Any]] = []
    final: FetchResult | None = None

    for attempt in range(1, config.max_attempts + 1):
        final = fetch_url(url, **kwargs)
        failure = final.evidence.failure_class
        trace.append(
            {
                "attempt": attempt,
                "ok": final.ok,
                "executed": final.executed,
                "failure_class": failure,
                "status_code": final.evidence.status_code,
            }
        )
        if final.ok or not final.executed:
            break
        if failure not in _RETRYABLE:
            break
        if attempt >= config.max_attempts:
            break

        retry_after = final.evidence.headers.get("retry-after")
        delay = min(
            config.max_delay_seconds,
            config.base_delay_seconds * (2 ** (attempt - 1)),
        )
        if retry_after:
            try:
                delay = min(config.max_delay_seconds, max(delay, float(retry_after)))
            except ValueError:
                pass
        if delay > 0:
            time.sleep(delay)

    assert final is not None
    return ResilientFetchResult(
        result=final,
        attempts=len(trace),
        recovery_trace=tuple(trace),
    )
