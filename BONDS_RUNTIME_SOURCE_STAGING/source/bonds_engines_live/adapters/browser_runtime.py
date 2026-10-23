# Imported source snapshot for BONDS adaptation.
# Source: alzahrani6020/AFAQ-GIE@b1fec7fa400c57f32c2022a21cf74039379fc3cf:engines_live/adapters/browser_runtime.py
# STAGING ONLY: not imported by BONDS runtime.

"""Dedicated live adapter for ENG-CAP-001 governed browser execution."""

from __future__ import annotations

from typing import Any, Mapping

from bonds_web_acquisition.browser import actions_from_payload, run_browser


def execute_001(payload: Mapping[str, Any]) -> dict[str, Any]:
    url = str(payload.get("url") or payload.get("start_url") or "").strip()
    if not url:
        return {
            "ok": False,
            "executed": False,
            "message": "ENG-CAP-001 requires url",
            "evidence": {"failure_class": "MISSING_URL"},
        }

    result = run_browser(
        url,
        actions=actions_from_payload(payload.get("actions")),
        headless=bool(payload.get("headless", True)),
        allow_private_networks=bool(payload.get("allow_private_networks", False)),
        capture_network=bool(payload.get("capture_network", True)),
        overall_timeout_ms=int(payload.get("overall_timeout_ms") or 60_000),
    )
    return {
        "ok": result.ok,
        "executed": result.executed,
        "message": f"ENG-CAP-001 browser runtime {result.state}",
        "evidence": {
            "browser": result.as_dict(),
            "execution_truth": result.state,
            "mission_verified": result.state == "MISSION_VERIFIED",
        },
    }


def make_browser_runtime_adapter():
    def handler(payload: Mapping[str, Any]) -> dict[str, Any]:
        return execute_001(payload)
    return handler
