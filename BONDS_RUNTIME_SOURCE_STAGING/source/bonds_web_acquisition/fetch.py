# Imported source snapshot for BONDS adaptation.
# Source: alzahrani6020/AFAQ-GIE@b1fec7fa400c57f32c2022a21cf74039379fc3cf:web_acquisition/fetch.py
# STAGING ONLY: not imported by BONDS runtime.

"""Governed HTTP acquisition primitives with SSRF resistance and evidence.

This module performs real network I/O only after current authority allows
execute_tool for the target URL. It never treats HTTP success as mission
verification.
"""

from __future__ import annotations

import hashlib
import ipaddress
import socket
import time
import urllib.error
import urllib.parse
import urllib.request
from datetime import datetime, timezone
from typing import Mapping

from current_authority.resolver import AuthorityRequest, resolve

from .contracts import FetchEvidence, FetchResult

_REDIRECT_CODES = {301, 302, 303, 307, 308}
_SAFE_SCHEMES = {"http", "https"}
_EVIDENCE_HEADERS = {
    "content-type",
    "content-length",
    "etag",
    "last-modified",
    "location",
    "retry-after",
    "x-request-id",
}


class AcquisitionBlocked(RuntimeError):
    pass


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _is_forbidden_ip(value: str) -> bool:
    ip = ipaddress.ip_address(value)
    return bool(
        ip.is_private
        or ip.is_loopback
        or ip.is_link_local
        or ip.is_multicast
        or ip.is_reserved
        or ip.is_unspecified
    )


def validate_public_url(url: str, *, allow_private_networks: bool = False) -> str:
    parsed = urllib.parse.urlsplit(url)
    if parsed.scheme.lower() not in _SAFE_SCHEMES:
        raise AcquisitionBlocked("UNSUPPORTED_SCHEME")
    if not parsed.hostname:
        raise AcquisitionBlocked("MISSING_HOST")
    if parsed.username or parsed.password:
        raise AcquisitionBlocked("URL_CREDENTIALS_FORBIDDEN")

    if allow_private_networks:
        return urllib.parse.urlunsplit(parsed)

    try:
        infos = socket.getaddrinfo(parsed.hostname, parsed.port or (443 if parsed.scheme == "https" else 80))
    except socket.gaierror as exc:
        raise AcquisitionBlocked("DNS_RESOLUTION_FAILED") from exc

    addresses = {info[4][0] for info in infos}
    if not addresses:
        raise AcquisitionBlocked("DNS_RESOLUTION_EMPTY")
    if any(_is_forbidden_ip(address) for address in addresses):
        raise AcquisitionBlocked("PRIVATE_OR_RESERVED_DESTINATION")

    return urllib.parse.urlunsplit(parsed)


class _NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):  # noqa: ANN001
        return None


def _headers_subset(headers: Mapping[str, str]) -> dict[str, str]:
    return {
        str(k).lower(): str(v)
        for k, v in headers.items()
        if str(k).lower() in _EVIDENCE_HEADERS
    }


def fetch_url(
    url: str,
    *,
    timeout_seconds: float = 15.0,
    max_bytes: int = 2_000_000,
    user_agent: str = "BONDS-GIE-WebAcquisition/1.0",
    allow_private_networks: bool = False,
    extra_headers: Mapping[str, str] | None = None,
    max_redirects: int = 5,
) -> FetchResult:
    requested_at = _now()
    started = time.perf_counter()

    try:
        current = validate_public_url(url, allow_private_networks=allow_private_networks)
    except AcquisitionBlocked as exc:
        return FetchResult(
            ok=False,
            executed=False,
            body=b"",
            evidence=FetchEvidence(
                url=url,
                requested_at=requested_at,
                status_code=None,
                content_type=None,
                content_length=0,
                content_hash=None,
                elapsed_ms=round((time.perf_counter() - started) * 1000, 3),
                final_url=None,
                failure_class="POLICY_BLOCK",
                blocked_reason=str(exc),
            ),
        )

    authority = resolve(AuthorityRequest(action="execute_tool", path=f"url:{current}"))
    if authority.outcome != "ALLOW":
        return FetchResult(
            ok=False,
            executed=False,
            body=b"",
            evidence=FetchEvidence(
                url=url,
                requested_at=requested_at,
                status_code=None,
                content_type=None,
                content_length=0,
                content_hash=None,
                elapsed_ms=round((time.perf_counter() - started) * 1000, 3),
                final_url=current,
                failure_class="AUTHORITY_BLOCK",
                blocked_reason=authority.reason,
            ),
        )

    opener = urllib.request.build_opener(_NoRedirect())
    headers = {"User-Agent": user_agent, "Accept": "*/*"}
    headers.update({str(k): str(v) for k, v in (extra_headers or {}).items()})

    redirects = 0
    while True:
        request = urllib.request.Request(current, headers=headers, method="GET")
        try:
            response = opener.open(request, timeout=timeout_seconds)
            status = int(getattr(response, "status", 200))
            raw_headers = dict(response.headers.items())
            body = response.read(max_bytes + 1)
            if len(body) > max_bytes:
                body = body[:max_bytes]
                failure_class = "BODY_TRUNCATED"
            else:
                failure_class = None
            digest = hashlib.sha256(body).hexdigest()
            return FetchResult(
                ok=200 <= status < 300,
                executed=True,
                body=body,
                evidence=FetchEvidence(
                    url=url,
                    requested_at=requested_at,
                    status_code=status,
                    content_type=response.headers.get_content_type(),
                    content_length=len(body),
                    content_hash=digest,
                    elapsed_ms=round((time.perf_counter() - started) * 1000, 3),
                    final_url=current,
                    headers=_headers_subset(raw_headers),
                    failure_class=failure_class,
                ),
            )
        except urllib.error.HTTPError as exc:
            status = int(exc.code)
            raw_headers = dict(exc.headers.items()) if exc.headers else {}
            if status in _REDIRECT_CODES and redirects < max_redirects:
                location = exc.headers.get("Location") if exc.headers else None
                if not location:
                    failure = "REDIRECT_WITHOUT_LOCATION"
                else:
                    next_url = urllib.parse.urljoin(current, location)
                    try:
                        current = validate_public_url(
                            next_url,
                            allow_private_networks=allow_private_networks,
                        )
                    except AcquisitionBlocked as blocked:
                        return FetchResult(
                            ok=False,
                            executed=True,
                            body=b"",
                            evidence=FetchEvidence(
                                url=url,
                                requested_at=requested_at,
                                status_code=status,
                                content_type=None,
                                content_length=0,
                                content_hash=None,
                                elapsed_ms=round((time.perf_counter() - started) * 1000, 3),
                                final_url=current,
                                headers=_headers_subset(raw_headers),
                                failure_class="REDIRECT_BLOCKED",
                                blocked_reason=str(blocked),
                            ),
                        )
                    redirects += 1
                    continue
            else:
                failure = (
                    "HTTP_429" if status == 429
                    else "HTTP_401" if status == 401
                    else "HTTP_403" if status == 403
                    else "HTTP_404" if status == 404
                    else "HTTP_5XX" if 500 <= status <= 599
                    else f"HTTP_{status}"
                )
            body = exc.read(max_bytes) if hasattr(exc, "read") else b""
            return FetchResult(
                ok=False,
                executed=True,
                body=body,
                evidence=FetchEvidence(
                    url=url,
                    requested_at=requested_at,
                    status_code=status,
                    content_type=(exc.headers.get_content_type() if exc.headers else None),
                    content_length=len(body),
                    content_hash=hashlib.sha256(body).hexdigest() if body else None,
                    elapsed_ms=round((time.perf_counter() - started) * 1000, 3),
                    final_url=current,
                    headers=_headers_subset(raw_headers),
                    failure_class=failure,
                ),
            )
        except urllib.error.URLError as exc:
            reason = getattr(exc, "reason", None)
            failure = "CONNECT_OR_DNS_FAILURE"
            if isinstance(reason, TimeoutError):
                failure = "CONNECT_TIMEOUT"
            return FetchResult(
                ok=False,
                executed=True,
                body=b"",
                evidence=FetchEvidence(
                    url=url,
                    requested_at=requested_at,
                    status_code=None,
                    content_type=None,
                    content_length=0,
                    content_hash=None,
                    elapsed_ms=round((time.perf_counter() - started) * 1000, 3),
                    final_url=current,
                    failure_class=failure,
                ),
            )
        except TimeoutError:
            return FetchResult(
                ok=False,
                executed=True,
                body=b"",
                evidence=FetchEvidence(
                    url=url,
                    requested_at=requested_at,
                    status_code=None,
                    content_type=None,
                    content_length=0,
                    content_hash=None,
                    elapsed_ms=round((time.perf_counter() - started) * 1000, 3),
                    final_url=current,
                    failure_class="READ_TIMEOUT",
                ),
            )
