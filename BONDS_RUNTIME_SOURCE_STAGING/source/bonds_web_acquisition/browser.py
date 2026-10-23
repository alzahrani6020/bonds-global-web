# Imported source snapshot for BONDS adaptation.
# Source: alzahrani6020/AFAQ-GIE@b1fec7fa400c57f32c2022a21cf74039379fc3cf:web_acquisition/browser.py
# STAGING ONLY: not imported by BONDS runtime.

"""Governed native browser runtime backed by Playwright when installed.

This module performs real browser I/O. It is intentionally bounded: no CAPTCHA
bypass, no credential guessing, no arbitrary JavaScript execution, and no
mission-success claim without independent verification.
"""

from __future__ import annotations

import hashlib
import json
import time
from pathlib import Path
from dataclasses import dataclass, field
from typing import Any, Mapping

from current_authority.resolver import AuthorityRequest, resolve

from .fetch import AcquisitionBlocked, validate_public_url


@dataclass(frozen=True)
class BrowserAction:
    kind: str
    selector: str | None = None
    value: str | None = None
    url: str | None = None
    timeout_ms: int = 10_000


@dataclass(frozen=True)
class BrowserRunResult:
    ok: bool
    executed: bool
    state: str
    final_url: str | None
    title: str | None
    html_sha256: str | None
    screenshot_sha256: str | None
    actions: tuple[dict[str, Any], ...]
    network: tuple[dict[str, Any], ...]
    failure_class: str | None = None
    details: dict[str, Any] = field(default_factory=dict)
    html: str | None = field(default=None, repr=False, compare=False)
    storage_state: dict[str, Any] | None = field(default=None, repr=False, compare=False)

    def as_dict(self) -> dict[str, Any]:
        return {
            "ok": self.ok,
            "executed": self.executed,
            "state": self.state,
            "final_url": self.final_url,
            "title": self.title,
            "html_sha256": self.html_sha256,
            "screenshot_sha256": self.screenshot_sha256,
            "actions": list(self.actions),
            "network": list(self.network),
            "failure_class": self.failure_class,
            "details": dict(self.details),
        }


def _authority(target: str) -> tuple[bool, str]:
    decision = resolve(AuthorityRequest(action="execute_tool", path=f"browser:{target}"))
    return decision.outcome == "ALLOW", decision.reason


def _captcha_present(text: str) -> bool:
    lower = text.lower()
    markers = ("captcha", "recaptcha", "hcaptcha", "verify you are human", "challenge-platform")
    return any(marker in lower for marker in markers)


def run_browser(
    start_url: str,
    *,
    actions: tuple[BrowserAction, ...] = (),
    headless: bool = True,
    allow_private_networks: bool = False,
    capture_network: bool = True,
    viewport: tuple[int, int] = (1440, 900),
    overall_timeout_ms: int = 60_000,
    storage_state: Mapping[str, Any] | None = None,
    allowed_upload_roots: tuple[str, ...] = (),
) -> BrowserRunResult:
    try:
        start_url = validate_public_url(start_url, allow_private_networks=allow_private_networks)
    except AcquisitionBlocked as exc:
        return BrowserRunResult(
            ok=False,
            executed=False,
            state="BLOCKED",
            final_url=None,
            title=None,
            html_sha256=None,
            screenshot_sha256=None,
            actions=(),
            network=(),
            failure_class=str(exc),
        )

    allowed, reason = _authority(start_url)
    if not allowed:
        return BrowserRunResult(
            ok=False,
            executed=False,
            state="BLOCKED",
            final_url=None,
            title=None,
            html_sha256=None,
            screenshot_sha256=None,
            actions=(),
            network=(),
            failure_class=f"AUTHORITY_{reason}",
        )

    try:
        from playwright.sync_api import TimeoutError as PlaywrightTimeoutError
        from playwright.sync_api import sync_playwright
    except ImportError:
        return BrowserRunResult(
            ok=False,
            executed=False,
            state="BLOCKED",
            final_url=None,
            title=None,
            html_sha256=None,
            screenshot_sha256=None,
            actions=(),
            network=(),
            failure_class="PLAYWRIGHT_NOT_INSTALLED",
        )

    network_events: list[dict[str, Any]] = []
    action_evidence: list[dict[str, Any]] = []
    current_action_index = -1
    started = time.perf_counter()

    try:
        with sync_playwright() as pw:
            browser = pw.chromium.launch(headless=headless)
            context_kwargs: dict[str, Any] = {
                "viewport": {"width": viewport[0], "height": viewport[1]}
            }
            if storage_state:
                context_kwargs["storage_state"] = dict(storage_state)
            context = browser.new_context(**context_kwargs)
            page = context.new_page()
            page.set_default_timeout(min(30_000, overall_timeout_ms))

            if capture_network:
                def on_request(req):  # noqa: ANN001
                    if len(network_events) >= 500:
                        return
                    network_events.append({
                        "type": "request",
                        "method": req.method,
                        "url": req.url,
                        "resource_type": req.resource_type,
                        "action_index": current_action_index,
                    })

                def on_response(resp):  # noqa: ANN001
                    if len(network_events) >= 500:
                        return
                    headers = resp.headers
                    network_events.append({
                        "type": "response",
                        "status": resp.status,
                        "url": resp.url,
                        "content_type": headers.get("content-type"),
                        "action_index": current_action_index,
                    })

                page.on("request", on_request)
                page.on("response", on_response)

                def on_websocket(ws):  # noqa: ANN001
                    if len(network_events) < 500:
                        network_events.append({
                            "type": "websocket_open",
                            "url": ws.url,
                            "action_index": current_action_index,
                        })

                    def frame_received(payload):  # noqa: ANN001
                        if len(network_events) >= 500:
                            return
                        raw = payload if isinstance(payload, bytes) else str(payload).encode("utf-8", errors="replace")
                        network_events.append({
                            "type": "websocket_frame_received",
                            "url": ws.url,
                            "bytes": len(raw),
                            "sha256": hashlib.sha256(raw).hexdigest(),
                            "action_index": current_action_index,
                        })

                    ws.on("framereceived", frame_received)

                page.on("websocket", on_websocket)

            page.goto(start_url, wait_until="domcontentloaded", timeout=min(30_000, overall_timeout_ms))
            page.wait_for_timeout(250)

            initial_content = page.content()
            if _captcha_present(initial_content):
                browser.close()
                return BrowserRunResult(
                    ok=False,
                    executed=True,
                    state="BLOCKED",
                    final_url=page.url,
                    title=page.title(),
                    html_sha256=hashlib.sha256(initial_content.encode("utf-8")).hexdigest(),
                    screenshot_sha256=None,
                    actions=tuple(action_evidence),
                    network=tuple(network_events),
                    failure_class="CAPTCHA_OR_HUMAN_CHALLENGE_PRESENT",
                )

            for index, action in enumerate(actions):
                current_action_index = index
                if (time.perf_counter() - started) * 1000 > overall_timeout_ms:
                    raise PlaywrightTimeoutError("overall browser budget exceeded")

                kind = action.kind.lower().strip()
                before_url = page.url
                if kind == "navigate":
                    if not action.url:
                        raise ValueError("navigate requires url")
                    target = validate_public_url(
                        action.url,
                        allow_private_networks=allow_private_networks,
                    )
                    allowed_action, action_reason = _authority(target)
                    if not allowed_action:
                        raise PermissionError(f"AUTHORITY_{action_reason}")
                    page.goto(target, wait_until="domcontentloaded", timeout=action.timeout_ms)
                elif kind == "click":
                    if not action.selector:
                        raise ValueError("click requires selector")
                    page.locator(action.selector).first.click(timeout=action.timeout_ms)
                elif kind == "fill":
                    if not action.selector:
                        raise ValueError("fill requires selector")
                    page.locator(action.selector).first.fill(action.value or "", timeout=action.timeout_ms)
                elif kind == "select":
                    if not action.selector:
                        raise ValueError("select requires selector")
                    page.locator(action.selector).first.select_option(action.value or "", timeout=action.timeout_ms)
                elif kind == "press":
                    if not action.selector:
                        raise ValueError("press requires selector")
                    page.locator(action.selector).first.press(action.value or "Enter", timeout=action.timeout_ms)
                elif kind == "scroll":
                    delta = int(action.value or "800")
                    page.mouse.wheel(0, delta)
                    page.wait_for_timeout(150)
                elif kind == "wait":
                    page.wait_for_timeout(min(int(action.value or "500"), action.timeout_ms))
                elif kind == "wait_for":
                    if not action.selector:
                        raise ValueError("wait_for requires selector")
                    page.locator(action.selector).first.wait_for(timeout=action.timeout_ms)
                elif kind == "infinite_scroll":
                    cycles = max(1, min(int(action.value or "8"), 50))
                    stable = 0
                    previous_height = -1
                    for _ in range(cycles):
                        height = int(page.evaluate("document.body.scrollHeight"))
                        page.mouse.wheel(0, max(800, height))
                        page.wait_for_timeout(250)
                        next_height = int(page.evaluate("document.body.scrollHeight"))
                        if next_height == previous_height or next_height == height:
                            stable += 1
                        else:
                            stable = 0
                        previous_height = next_height
                        if stable >= 2:
                            break
                elif kind == "frame_click":
                    if not action.selector or not action.value:
                        raise ValueError("frame_click requires selector and frame selector value")
                    page.frame_locator(action.value).locator(action.selector).first.click(timeout=action.timeout_ms)
                elif kind == "popup_click":
                    if not action.selector:
                        raise ValueError("popup_click requires selector")
                    with page.expect_popup(timeout=action.timeout_ms) as popup_info:
                        page.locator(action.selector).first.click(timeout=action.timeout_ms)
                    page = popup_info.value
                    page.wait_for_load_state("domcontentloaded", timeout=action.timeout_ms)
                elif kind == "upload":
                    if not action.selector or not action.value:
                        raise ValueError("upload requires selector and file path")
                    candidate = Path(action.value).expanduser().resolve()
                    roots = tuple(Path(root).expanduser().resolve() for root in allowed_upload_roots)
                    if not roots or not any(candidate.is_relative_to(root) for root in roots):
                        raise PermissionError("UPLOAD_PATH_OUTSIDE_ALLOWED_ROOTS")
                    if not candidate.is_file():
                        raise ValueError("upload file does not exist")
                    page.locator(action.selector).first.set_input_files(str(candidate), timeout=action.timeout_ms)
                elif kind == "download_click":
                    if not action.selector:
                        raise ValueError("download_click requires selector")
                    with page.expect_download(timeout=action.timeout_ms) as download_info:
                        page.locator(action.selector).first.click(timeout=action.timeout_ms)
                    download = download_info.value
                    path = download.path()
                    if path:
                        data = Path(path).read_bytes()
                        action_evidence.append({
                            "index": index,
                            "kind": "download_artifact",
                            "suggested_filename": download.suggested_filename,
                            "sha256": hashlib.sha256(data).hexdigest(),
                            "bytes": len(data),
                        })
                else:
                    raise ValueError(f"unsupported browser action: {action.kind}")

                after = page.content()
                if _captcha_present(after):
                    raise PermissionError("CAPTCHA_OR_HUMAN_CHALLENGE_PRESENT")
                action_evidence.append({
                    "index": index,
                    "kind": kind,
                    "selector": action.selector,
                    "before_url": before_url,
                    "after_url": page.url,
                    "dom_sha256": hashlib.sha256(after.encode("utf-8")).hexdigest(),
                })

            html = page.content()
            screenshot = page.screenshot(full_page=False)
            title = page.title()
            final_url = page.url
            final_storage_state = context.storage_state()
            context.close()
            browser.close()
            return BrowserRunResult(
                ok=True,
                executed=True,
                state="EFFECT_OBSERVED",
                final_url=final_url,
                title=title,
                html_sha256=hashlib.sha256(html.encode("utf-8")).hexdigest(),
                screenshot_sha256=hashlib.sha256(screenshot).hexdigest(),
                actions=tuple(action_evidence),
                network=tuple(network_events),
                details={
                    "elapsed_ms": round((time.perf_counter() - started) * 1000, 3),
                    "session_isolation": "NEW_BROWSER_CONTEXT",
                    "arbitrary_javascript_execution": False,
                    "captcha_bypass": False,
                    "mission_verified": False,
                },
                html=html,
                storage_state=final_storage_state,
            )
    except PermissionError as exc:
        return BrowserRunResult(
            ok=False,
            executed=True,
            state="BLOCKED",
            final_url=None,
            title=None,
            html_sha256=None,
            screenshot_sha256=None,
            actions=tuple(action_evidence),
            network=tuple(network_events),
            failure_class=str(exc),
        )
    except PlaywrightTimeoutError:
        return BrowserRunResult(
            ok=False,
            executed=True,
            state="FAILED",
            final_url=None,
            title=None,
            html_sha256=None,
            screenshot_sha256=None,
            actions=tuple(action_evidence),
            network=tuple(network_events),
            failure_class="BROWSER_TIMEOUT",
        )
    except Exception as exc:  # noqa: BLE001
        return BrowserRunResult(
            ok=False,
            executed=True,
            state="FAILED",
            final_url=None,
            title=None,
            html_sha256=None,
            screenshot_sha256=None,
            actions=tuple(action_evidence),
            network=tuple(network_events),
            failure_class=type(exc).__name__,
            details={"error": str(exc)[:500]},
        )


def actions_from_payload(values: Any) -> tuple[BrowserAction, ...]:
    if not isinstance(values, (list, tuple)):
        return ()
    out = []
    for raw in values:
        if not isinstance(raw, Mapping):
            continue
        out.append(
            BrowserAction(
                kind=str(raw.get("kind") or raw.get("action") or ""),
                selector=str(raw["selector"]) if raw.get("selector") is not None else None,
                value=str(raw["value"]) if raw.get("value") is not None else None,
                url=str(raw["url"]) if raw.get("url") is not None else None,
                timeout_ms=int(raw.get("timeout_ms") or 10_000),
            )
        )
    return tuple(out)
