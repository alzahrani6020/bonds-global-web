# Imported source snapshot for BONDS adaptation.
# Source: alzahrani6020/AFAQ-GIE@b1fec7fa400c57f32c2022a21cf74039379fc3cf:web_acquisition/network_intelligence.py
# STAGING ONLY: not imported by BONDS runtime.

"""Derive observable API candidates from browser network evidence."""

from __future__ import annotations

import urllib.parse
from dataclasses import dataclass
from typing import Any, Mapping


@dataclass(frozen=True)
class NetworkOperation:
    method: str
    url: str
    action_index: int
    response_status: int | None
    resource_type: str | None
    candidate_kind: str

    def as_dict(self) -> dict[str, Any]:
        return {
            "method": self.method,
            "url": self.url,
            "action_index": self.action_index,
            "response_status": self.response_status,
            "resource_type": self.resource_type,
            "candidate_kind": self.candidate_kind,
        }


def derive_network_operations(events: tuple[Mapping[str, Any], ...]) -> tuple[NetworkOperation, ...]:
    responses: dict[tuple[int, str], int] = {}
    for event in events:
        if str(event.get("type")) != "response":
            continue
        key = (int(event.get("action_index", -1)), str(event.get("url") or ""))
        responses[key] = int(event.get("status")) if event.get("status") is not None else 0

    operations: list[NetworkOperation] = []
    seen: set[tuple[str, str, int]] = set()
    for event in events:
        if str(event.get("type")) != "request":
            continue
        method = str(event.get("method") or "GET").upper()
        url = str(event.get("url") or "")
        action_index = int(event.get("action_index", -1))
        resource_type = str(event.get("resource_type") or "") or None
        if not url:
            continue
        parsed = urllib.parse.urlsplit(url)
        path = parsed.path.lower()
        kind = "resource"
        if "graphql" in path:
            kind = "graphql_candidate"
        elif "/api/" in path or path.startswith("/api") or "/v1/" in path or "/v2/" in path:
            kind = "api_candidate"
        elif method not in {"GET", "HEAD", "OPTIONS"}:
            kind = "side_effect_candidate"
        elif resource_type in {"xhr", "fetch"}:
            kind = "structured_request_candidate"

        key = (method, url, action_index)
        if key in seen:
            continue
        seen.add(key)
        operations.append(
            NetworkOperation(
                method=method,
                url=url,
                action_index=action_index,
                response_status=responses.get((action_index, url)),
                resource_type=resource_type,
                candidate_kind=kind,
            )
        )

    return tuple(operations)
