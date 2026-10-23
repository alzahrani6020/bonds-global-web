# Imported source snapshot for BONDS adaptation.
# Source: alzahrani6020/AFAQ-GIE@b1fec7fa400c57f32c2022a21cf74039379fc3cf:web_acquisition/api_discovery.py
# STAGING ONLY: not imported by BONDS runtime.

"""Public API surface discovery with evidence-bearing probes."""

from __future__ import annotations

import json
import urllib.parse
from dataclasses import dataclass
from typing import Any

from .fetch import fetch_url


_DEFAULT_API_PATHS = (
    "/openapi.json",
    "/swagger.json",
    "/api/openapi.json",
    "/api-docs",
    "/docs/openapi.json",
    "/.well-known/openapi.json",
    "/graphql",
)


@dataclass(frozen=True)
class ApiSurface:
    url: str
    kind: str
    observed: bool
    status_code: int | None
    evidence_ref: str | None
    operations: tuple[str, ...]
    version: str | None
    failure_class: str | None = None

    def as_dict(self) -> dict[str, Any]:
        return {
            "url": self.url,
            "kind": self.kind,
            "observed": self.observed,
            "status_code": self.status_code,
            "evidence_ref": self.evidence_ref,
            "operations": list(self.operations),
            "version": self.version,
            "failure_class": self.failure_class,
        }


def _origin(url: str) -> str:
    parsed = urllib.parse.urlsplit(url)
    return urllib.parse.urlunsplit((parsed.scheme, parsed.netloc, "", "", ""))


def _parse_openapi(raw: str) -> tuple[tuple[str, ...], str | None]:
    try:
        data = json.loads(raw)
    except json.JSONDecodeError:
        return (), None
    if not isinstance(data, dict):
        return (), None
    if not (data.get("openapi") or data.get("swagger")):
        return (), None
    operations: list[str] = []
    paths = data.get("paths")
    if isinstance(paths, dict):
        for path, methods in paths.items():
            if not isinstance(methods, dict):
                continue
            for method in methods:
                if str(method).lower() in {"get", "post", "put", "patch", "delete", "options", "head"}:
                    operations.append(f"{str(method).upper()} {path}")
    version = str(data.get("openapi") or data.get("swagger"))
    return tuple(sorted(operations)), version


def discover_api_surfaces(
    seed_urls: tuple[str, ...],
    *,
    allow_private_networks: bool = False,
    timeout_seconds: float = 10.0,
    max_bytes: int = 2_000_000,
) -> tuple[ApiSurface, ...]:
    candidates: list[str] = []
    for seed in seed_urls:
        origin = _origin(seed)
        for path in _DEFAULT_API_PATHS:
            candidates.append(urllib.parse.urljoin(origin + "/", path.lstrip("/")))

    surfaces: list[ApiSurface] = []
    for url in sorted(dict.fromkeys(candidates)):
        result = fetch_url(
            url,
            timeout_seconds=timeout_seconds,
            max_bytes=max_bytes,
            allow_private_networks=allow_private_networks,
        )
        evidence_ref = (
            f"web:{result.evidence.content_hash}:{url}"
            if result.evidence.content_hash
            else None
        )
        if not result.ok:
            surfaces.append(
                ApiSurface(
                    url=url,
                    kind="candidate",
                    observed=False,
                    status_code=result.evidence.status_code,
                    evidence_ref=evidence_ref,
                    operations=(),
                    version=None,
                    failure_class=result.evidence.failure_class,
                )
            )
            continue

        operations, version = _parse_openapi(result.text)
        if operations or version:
            kind = "openapi"
            observed = True
        elif urllib.parse.urlsplit(url).path.rstrip("/").endswith("graphql"):
            kind = "graphql_endpoint_candidate"
            observed = True
        else:
            kind = "api_document_candidate"
            observed = True

        surfaces.append(
            ApiSurface(
                url=url,
                kind=kind,
                observed=observed,
                status_code=result.evidence.status_code,
                evidence_ref=evidence_ref,
                operations=operations,
                version=version,
            )
        )
    return tuple(surfaces)
