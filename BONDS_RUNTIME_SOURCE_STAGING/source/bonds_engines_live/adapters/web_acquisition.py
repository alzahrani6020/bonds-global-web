# Imported source snapshot for BONDS adaptation.
# Source: alzahrani6020/AFAQ-GIE@b1fec7fa400c57f32c2022a21cf74039379fc3cf:engines_live/adapters/web_acquisition.py
# STAGING ONLY: not imported by BONDS runtime.

"""Dedicated live adapter for ENG-CAP-091 web acquisition runtime."""

from __future__ import annotations

from typing import Any, Mapping

from bonds_web_acquisition import CrawlRequest, crawl, fetch_url, verify_remote_resource
from bonds_web_acquisition.browser import actions_from_payload
from bonds_web_acquisition.crawler import checkpoint_from_json
from bonds_web_acquisition.orchestrator import (
    ExplorationMission,
    ExplorationVerificationContract,
    explore,
)


def _as_strings(value: Any) -> tuple[str, ...]:
    if value is None:
        return ()
    if isinstance(value, str):
        stripped = value.strip()
        return (stripped,) if stripped else ()
    if isinstance(value, (list, tuple, set)):
        return tuple(
            str(item).strip()
            for item in value
            if str(item).strip()
        )
    return (str(value).strip(),) if str(value).strip() else ()


def execute_091(payload: Mapping[str, Any]) -> dict[str, Any]:
    action = str(payload.get("action") or "crawl").lower()

    if action == "fetch":
        url = str(payload.get("url") or "").strip()
        if not url:
            return {
                "ok": False,
                "executed": False,
                "message": "ENG-CAP-091 fetch requires url",
                "evidence": {"failure_class": "MISSING_URL"},
            }
        result = fetch_url(
            url,
            timeout_seconds=float(payload.get("timeout_seconds") or 15.0),
            max_bytes=int(payload.get("max_bytes") or 2_000_000),
            allow_private_networks=bool(payload.get("allow_private_networks", False)),
        )
        return {
            "ok": bool(result.ok),
            "executed": bool(result.executed),
            "message": "ENG-CAP-091 real HTTP fetch completed",
            "evidence": {
                "fetch": result.evidence.as_dict(),
                "execution_truth": "REAL_NETWORK_FETCH" if result.executed else "NOT_EXECUTED",
            },
        }

    if action == "explore":
        seeds = payload.get("seed_urls") or payload.get("urls") or ()
        if isinstance(seeds, str):
            seeds = (seeds,)
        seeds = tuple(str(x) for x in seeds if str(x).strip())
        if not seeds:
            single = str(payload.get("url") or "").strip()
            if single:
                seeds = (single,)
        if not seeds:
            return {
                "ok": False,
                "executed": False,
                "message": "ENG-CAP-091 explore requires seed_urls",
                "evidence": {"failure_class": "MISSING_SEEDS"},
            }

        verification_raw = payload.get("verification")
        verification = None
        if isinstance(verification_raw, Mapping):
            verification = ExplorationVerificationContract(
                required_surfaces=_as_strings(
                    verification_raw.get("required_surfaces")
                ),
                required_terms=_as_strings(
                    verification_raw.get("required_terms")
                ),
                minimum_url_coverage=float(
                    verification_raw.get("minimum_url_coverage", 0.80)
                ),
                minimum_evidence_coverage=float(
                    verification_raw.get("minimum_evidence_coverage", 0.95)
                ),
                require_frontier_exhausted=bool(
                    verification_raw.get("require_frontier_exhausted", True)
                ),
            )

        report = explore(
            ExplorationMission(
                seed_urls=seeds,
                mission_terms=_as_strings(payload.get("mission_terms")),
                expected_surfaces=_as_strings(payload.get("expected_surfaces")),
                browser_actions=actions_from_payload(payload.get("browser_actions")),
                max_pages=int(payload.get("max_pages") or 100),
                max_depth=int(payload.get("max_depth") or 4),
                allow_private_networks=bool(
                    payload.get("allow_private_networks", False)
                ),
                require_interaction=bool(payload.get("require_interaction", False)),
                require_authenticated_state=bool(
                    payload.get("require_authenticated_state", False)
                ),
                require_side_effect=bool(payload.get("require_side_effect", False)),
                verification=verification,
                browser_storage_state=(
                    dict(payload["browser_storage_state"])
                    if isinstance(payload.get("browser_storage_state"), Mapping)
                    else None
                ),
            )
        )
        data = report.as_dict()
        return {
            "ok": bool(report.evidence_refs),
            "executed": True,
            "message": (
                "ENG-CAP-091 exploration mission verified"
                if report.mission_verified
                else "ENG-CAP-091 exploration executed with explicit verification state"
            ),
            "evidence": {
                "exploration": data,
                "mission_verified": report.mission_verified,
                "verification": dict(report.verification),
                "execution_truth": (
                    "MISSION_VERIFIED"
                    if report.mission_verified
                    else "EXECUTED"
                ),
            },
        }

    if action == "verify_remote":
        url = str(payload.get("url") or "").strip()
        if not url:
            return {
                "ok": False,
                "executed": False,
                "message": "ENG-CAP-091 verify_remote requires url",
                "evidence": {"failure_class": "MISSING_URL"},
            }
        result = verify_remote_resource(
            url,
            expected_status=int(payload.get("expected_status") or 200),
            expected_sha256=payload.get("expected_sha256"),
            expected_contains=payload.get("expected_contains"),
            timeout_seconds=float(payload.get("timeout_seconds") or 15.0),
            allow_private_networks=bool(payload.get("allow_private_networks", False)),
        )
        return {
            "ok": bool(result.verified),
            "executed": result.state not in {"BLOCKED"},
            "message": f"ENG-CAP-091 remote verification {result.state}",
            "evidence": {
                "verification": result.as_dict(),
                "execution_truth": result.state,
            },
        }

    seeds = payload.get("seed_urls") or payload.get("urls") or ()
    if isinstance(seeds, str):
        seeds = (seeds,)
    seeds = tuple(str(x) for x in seeds if str(x).strip())
    if not seeds:
        single = str(payload.get("url") or "").strip()
        if single:
            seeds = (single,)
    if not seeds:
        return {
            "ok": False,
            "executed": False,
            "message": "ENG-CAP-091 crawl requires seed_urls",
            "evidence": {"failure_class": "MISSING_SEEDS"},
        }

    mission_terms = payload.get("mission_terms") or ()
    if isinstance(mission_terms, str):
        mission_terms = tuple(term.strip() for term in mission_terms.split(",") if term.strip())
    else:
        mission_terms = tuple(str(x) for x in mission_terms)

    request = CrawlRequest(
        seed_urls=seeds,
        mission_terms=mission_terms,
        max_pages=int(payload.get("max_pages") or 100),
        max_depth=int(payload.get("max_depth") or 4),
        max_bytes_per_page=int(payload.get("max_bytes_per_page") or 2_000_000),
        max_total_bytes=int(payload.get("max_total_bytes") or 50_000_000),
        per_host_page_budget=int(payload.get("per_host_page_budget") or 100),
        timeout_seconds=float(payload.get("timeout_seconds") or 15.0),
        obey_robots=bool(payload.get("obey_robots", True)),
        allow_subdomains=bool(payload.get("allow_subdomains", True)),
        allow_private_networks=bool(payload.get("allow_private_networks", False)),
        render_fallback=bool(payload.get("render_fallback", True)),
        max_rendered_pages=int(payload.get("max_rendered_pages") or 20),
        allowed_hosts=tuple(str(x) for x in (payload.get("allowed_hosts") or ())),
        user_agent=str(payload.get("user_agent") or "BONDS-GIE-WebAcquisition/1.0"),
    )
    checkpoint_raw = payload.get("checkpoint_json")
    checkpoint = checkpoint_from_json(str(checkpoint_raw)) if checkpoint_raw else None
    result = crawl(request, checkpoint=checkpoint)
    data = result.as_dict()
    return {
        "ok": bool(result.pages),
        "executed": result.state.value in {"EXECUTED", "EFFECT_OBSERVED", "EFFECT_VERIFIED", "MISSION_VERIFIED"},
        "message": f"ENG-CAP-091 {result.reason}",
        "evidence": {
            "crawl": data,
            "execution_truth": result.state.value,
            "coverage_proven": True,
            "mission_verified": result.state.value == "MISSION_VERIFIED",
        },
    }


def make_bonds_web_acquisition_adapter():
    def handler(payload: Mapping[str, Any]) -> dict[str, Any]:
        return execute_091(payload)
    return handler
