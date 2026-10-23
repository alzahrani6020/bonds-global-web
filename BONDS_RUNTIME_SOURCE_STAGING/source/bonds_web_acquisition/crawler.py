# Imported source snapshot for BONDS adaptation.
# Source: alzahrani6020/AFAQ-GIE@b1fec7fa400c57f32c2022a21cf74039379fc3cf:web_acquisition/crawler.py
# STAGING ONLY: not imported by BONDS runtime.

"""Mission-driven crawl runtime with frontier scoring, checkpoints and coverage.

The runtime performs real HTTP acquisition through fetch_url(). It is bounded,
robots-aware by default, fail-closed for private/reserved destinations, and
never converts a fetched page into a verified mission claim by itself.
"""

from __future__ import annotations

import hashlib
import heapq
import json
import math
import urllib.parse
import urllib.robotparser
from dataclasses import dataclass
from typing import Iterable

from .contracts import (
    AcquisitionState,
    CoverageReport,
    CrawlCheckpoint,
    CrawlRequest,
    CrawlResult,
    PageObservation,
)
from .discovery import parse_html, parse_robots_sitemaps, parse_sitemap, same_site
from .fetch import fetch_url
from .resilience import fetch_resilient
from .browser import run_browser
from .dedup import find_near_duplicate, simhash64
from .content_extraction import extract_content


@dataclass(order=True)
class _FrontierItem:
    sort_key: tuple[float, int, str]
    url: str
    depth: int

    @classmethod
    def make(cls, url: str, depth: int, score: float) -> "_FrontierItem":
        # heapq is min-first; negative score gives max-first semantics.
        return cls(sort_key=(-round(score, 6), depth, url), url=url, depth=depth)


def _seed_host(url: str) -> str:
    return (urllib.parse.urlsplit(url).hostname or "").lower()


def _path_score(url: str, mission_terms: tuple[str, ...]) -> float:
    parsed = urllib.parse.urlsplit(url)
    blob = f"{parsed.netloc} {parsed.path} {parsed.query}".lower()
    score = 1.0
    high_value = {
        "docs": 1.8,
        "documentation": 1.8,
        "developers": 1.9,
        "developer": 1.9,
        "api": 2.0,
        "reference": 1.6,
        "sdk": 1.8,
        "pricing": 1.5,
        "changelog": 1.7,
        "release": 1.5,
        "status": 1.3,
        "security": 1.2,
        "privacy": 1.2,
        "oauth": 1.5,
        "auth": 1.5,
        "webhook": 1.6,
        "models": 1.5,
        "limits": 1.4,
        "quota": 1.4,
    }
    for needle, weight in high_value.items():
        if needle in blob:
            score += weight
    for term in mission_terms:
        if term and term.lower() in blob:
            score += 2.5
    depth_penalty = max(0, parsed.path.count("/") - 2) * 0.1
    return score - depth_penalty


def _default_surface_urls(seed_url: str) -> tuple[str, ...]:
    parsed = urllib.parse.urlsplit(seed_url)
    origin = urllib.parse.urlunsplit((parsed.scheme, parsed.netloc, "", "", ""))
    candidates = (
        "/robots.txt",
        "/sitemap.xml",
        "/sitemap_index.xml",
        "/openapi.json",
        "/openapi.yaml",
        "/swagger.json",
        "/api-docs",
        "/docs",
        "/developers",
        "/developer",
        "/changelog",
        "/releases",
        "/pricing",
        "/status",
        "/.well-known/openid-configuration",
    )
    return tuple(urllib.parse.urljoin(origin + "/", item.lstrip("/")) for item in candidates)


def _allowed_host(request: CrawlRequest, seed_hosts: set[str], url: str) -> bool:
    host = _seed_host(url)
    if not host:
        return False
    explicit = {h.lower().strip(".") for h in request.allowed_hosts}
    if explicit and host in explicit:
        return True
    return any(same_site(seed, host, allow_subdomains=request.allow_subdomains) for seed in seed_hosts)


def _evidence_ref(page: PageObservation) -> str:
    digest = page.fetch.content_hash or "nohash"
    return f"web:{digest}:{page.url}"


def _coverage(
    *,
    discovered: set[str],
    visited: set[str],
    failed: set[str],
    blocked: set[str],
    pending: Iterable[_FrontierItem],
    pages: list[PageObservation],
    near_duplicate_count: int,
) -> CoverageReport:
    pending_urls = {item.url for item in pending if item.url not in visited}
    denominator = max(1, len(discovered))
    url_coverage = round(len(visited) / denominator, 6)
    evidence_ready = sum(
        1
        for page in pages
        if page.fetch.status_code is not None and page.fetch.content_hash
    )
    evidence_coverage = round(evidence_ready / max(1, len(pages)), 6)
    surfaces = sorted({surface for page in pages for surface in page.discovered_surfaces})
    unknowns: list[str] = []
    if pending_urls:
        unknowns.append("FRONTIER_REMAINS")
    if blocked:
        unknowns.append("BLOCKED_SURFACES")
    if failed:
        unknowns.append("FAILED_SURFACES")
    if not pages:
        unknowns.append("NO_SUCCESSFUL_ACQUISITION")
    return CoverageReport(
        discovered_count=len(discovered),
        visited_count=len(visited),
        failed_count=len(failed),
        blocked_count=len(blocked),
        pending_count=len(pending_urls),
        url_coverage=url_coverage,
        evidence_coverage=evidence_coverage,
        surface_types=tuple(surfaces),
        unknowns=tuple(unknowns),
        near_duplicate_count=near_duplicate_count,
    )


def _checkpoint(
    frontier: list[_FrontierItem],
    visited: set[str],
    discovered: set[str],
    failed: set[str],
    blocked: set[str],
) -> CrawlCheckpoint:
    pending = tuple(
        (float(-item.sort_key[0]), item.depth, item.url)
        for item in sorted(frontier)
        if item.url not in visited
    )
    return CrawlCheckpoint(
        pending=pending,
        visited=tuple(sorted(visited)),
        discovered=tuple(sorted(discovered)),
        failed=tuple(sorted(failed)),
        blocked=tuple(sorted(blocked)),
    )


def _restore_frontier(checkpoint: CrawlCheckpoint | None) -> tuple[list[_FrontierItem], set[str], set[str], set[str], set[str]]:
    if checkpoint is None:
        return [], set(), set(), set(), set()
    frontier = [_FrontierItem.make(url, int(depth), float(score)) for score, depth, url in checkpoint.pending]
    heapq.heapify(frontier)
    return (
        frontier,
        set(checkpoint.visited),
        set(checkpoint.discovered),
        set(checkpoint.failed),
        set(checkpoint.blocked),
    )


def crawl(
    request: CrawlRequest,
    *,
    checkpoint: CrawlCheckpoint | None = None,
) -> CrawlResult:
    frontier, visited, discovered, failed, blocked = _restore_frontier(checkpoint)
    pages: list[PageObservation] = []
    evidence_refs: list[str] = []
    seed_hosts = {_seed_host(url) for url in request.seed_urls if _seed_host(url)}

    queued = {item.url for item in frontier}

    def enqueue(url: str, depth: int, *, bonus: float = 0.0) -> None:
        if depth > request.max_depth:
            return
        if url in visited or url in queued:
            return
        if not _allowed_host(request, seed_hosts, url):
            return
        discovered.add(url)
        heapq.heappush(
            frontier,
            _FrontierItem.make(url, depth, _path_score(url, request.mission_terms) + bonus),
        )
        queued.add(url)

    if checkpoint is None:
        for seed in request.seed_urls:
            enqueue(seed, 0, bonus=10.0)
            for surface in _default_surface_urls(seed):
                enqueue(surface, 1, bonus=3.0)

    robot_parsers: dict[str, urllib.robotparser.RobotFileParser] = {}
    host_counts: dict[str, int] = {}
    total_bytes = 0
    seen_content_hashes: set[str] = set()
    rendered_pages = 0
    semantic_hashes: dict[str, int] = {}
    near_duplicate_count = 0

    def robot_allowed(url: str) -> bool:
        if not request.obey_robots:
            return True
        parsed = urllib.parse.urlsplit(url)
        origin = urllib.parse.urlunsplit((parsed.scheme, parsed.netloc, "", "", ""))
        if origin not in robot_parsers:
            robot_url = urllib.parse.urljoin(origin + "/", "robots.txt")
            resilient = fetch_resilient(
                robot_url,
                timeout_seconds=request.timeout_seconds,
                max_bytes=min(request.max_bytes_per_page, 512_000),
                user_agent=request.user_agent,
                allow_private_networks=request.allow_private_networks,
            )
            result = resilient.result
            parser = urllib.robotparser.RobotFileParser()
            parser.set_url(robot_url)
            if result.ok:
                text = result.text
                parser.parse(text.splitlines())
                for sitemap in parse_robots_sitemaps(text, origin):
                    enqueue(sitemap, 1, bonus=5.0)
            else:
                # Missing/unavailable robots does not fabricate a deny rule.
                parser.parse([])
            robot_parsers[origin] = parser
        return robot_parsers[origin].can_fetch(request.user_agent, url)

    while frontier and len(visited) < request.max_pages:
        item = heapq.heappop(frontier)
        queued.discard(item.url)
        if item.url in visited:
            continue
        host = _seed_host(item.url)
        if host_counts.get(host, 0) >= request.per_host_page_budget:
            blocked.add(item.url)
            visited.add(item.url)
            continue
        if total_bytes >= request.max_total_bytes:
            break
        if not robot_allowed(item.url):
            blocked.add(item.url)
            visited.add(item.url)
            continue

        resilient = fetch_resilient(
            item.url,
            timeout_seconds=request.timeout_seconds,
            max_bytes=request.max_bytes_per_page,
            user_agent=request.user_agent,
            allow_private_networks=request.allow_private_networks,
        )
        result = resilient.result
        visited.add(item.url)
        host_counts[host] = host_counts.get(host, 0) + 1
        total_bytes += result.evidence.content_length

        if not result.executed:
            blocked.add(item.url)
            continue
        if not result.ok:
            failed.add(item.url)
            continue

        if result.evidence.content_hash and result.evidence.content_hash in seen_content_hashes:
            continue
        if result.evidence.content_hash:
            seen_content_hashes.add(result.evidence.content_hash)

        content_type = (result.evidence.content_type or "").lower()
        extracted = extract_content(
            result.body,
            content_type=result.evidence.content_type,
            url=item.url,
            max_chars=min(250_000, request.max_bytes_per_page),
        )
        browser = None
        parsed_data = {
            "title": None,
            "links": (),
            "surfaces": (),
            "semantic_hints": (),
            "render_required": False,
        }

        if content_type in {"text/html", "application/xhtml+xml"} or "<html" in result.text[:2048].lower():
            parsed_data = parse_html(item.url, result.text, request.mission_terms)
            if (
                parsed_data["render_required"]
                and request.render_fallback
                and rendered_pages < request.max_rendered_pages
            ):
                browser = run_browser(
                    item.url,
                    allow_private_networks=request.allow_private_networks,
                    capture_network=True,
                    overall_timeout_ms=int(request.timeout_seconds * 1000),
                )
                if browser.ok and browser.html:
                    rendered_pages += 1
                    parsed_data = parse_html(item.url, browser.html, request.mission_terms)
                    if browser.html_sha256:
                        evidence_refs.append(f"browserdom:{browser.html_sha256}:{item.url}")
                    if browser.screenshot_sha256:
                        evidence_refs.append(f"browserscreen:{browser.screenshot_sha256}:{item.url}")
        elif "xml" in content_type or item.url.lower().endswith((".xml", ".rss", ".atom")):
            sitemap_links = parse_sitemap(result.text, item.url)
            combined_links = tuple(sorted(dict.fromkeys((*sitemap_links, *extracted.links))))
            parsed_data = {
                "title": None,
                "links": combined_links,
                "surfaces": ("sitemap",) if sitemap_links else (),
                "semantic_hints": (),
                "render_required": False,
            }
        elif any(token in item.url.lower() for token in ("openapi", "swagger", "api-docs")):
            parsed_data = {
                "title": None,
                "links": tuple(extracted.links),
                "surfaces": ("api",),
                "semantic_hints": (),
                "render_required": False,
            }
        elif extracted.links:
            parsed_data = {
                "title": None,
                "links": tuple(extracted.links),
                "surfaces": (),
                "semantic_hints": tuple(
                    term for term in request.mission_terms
                    if term and term.lower() in extracted.text.lower()
                ),
                "render_required": False,
            }

        semantic_source = browser.html if (
            browser is not None and browser.ok and browser.html
        ) else result.text
        verification_extracted = extracted
        if browser is not None and browser.ok and browser.html:
            verification_extracted = extract_content(
                browser.html.encode("utf-8"),
                content_type="text/html",
                url=item.url,
                max_chars=min(250_000, request.max_bytes_per_page),
            )
        verification_text = verification_extracted.text.lower()
        observed_mission_terms = tuple(
            sorted(
                dict.fromkeys(
                    term
                    for term in request.mission_terms
                    if term and term.lower() in verification_text
                )
            )
        )
        duplicate = find_near_duplicate(semantic_source, semantic_hashes)
        semantic_value = simhash64(semantic_source)
        semantic_hex = f"{semantic_value:016x}"
        if duplicate.duplicate:
            near_duplicate_count += 1
        else:
            semantic_hashes[item.url] = semantic_value

        page = PageObservation(
            url=item.url,
            depth=item.depth,
            fetch=result.evidence,
            title=parsed_data["title"],
            links=tuple(parsed_data["links"]),
            discovered_surfaces=tuple(parsed_data["surfaces"]),
            render_required=bool(parsed_data["render_required"]),
            semantic_hints=observed_mission_terms,
            content_hash=result.evidence.content_hash,
            semantic_fingerprint=semantic_hex,
            near_duplicate_of=duplicate.matched_url,
            content_format=extracted.format,
            extracted_text_hash=(
                hashlib.sha256(extracted.text.encode("utf-8")).hexdigest()
                if extracted.text else None
            ),
            extraction_warnings=tuple(extracted.warnings),
        )
        pages.append(page)
        evidence_refs.append(_evidence_ref(page))

        # Explicit links observed in acquired content outrank speculative
        # well-known probes so the probe set cannot starve the real link graph.
        novelty_bonus = 5.0 + math.log1p(len(page.discovered_surfaces))
        for link in page.links:
            enqueue(link, item.depth + 1, bonus=novelty_bonus)

    coverage = _coverage(
        discovered=discovered,
        visited=visited,
        failed=failed,
        blocked=blocked,
        pending=frontier,
        pages=pages,
        near_duplicate_count=near_duplicate_count,
    )
    state = AcquisitionState.EXECUTED if pages else (
        AcquisitionState.BLOCKED if blocked and not failed else AcquisitionState.FAILED
    )
    reason = (
        "BOUNDED_CRAWL_EXECUTED_WITH_MEASURED_COVERAGE"
        if pages
        else "NO_SUCCESSFUL_PAGE_ACQUISITION"
    )
    return CrawlResult(
        state=state,
        pages=tuple(pages),
        coverage=coverage,
        checkpoint=_checkpoint(frontier, visited, discovered, failed, blocked),
        evidence_refs=tuple(evidence_refs),
        reason=reason,
    )


def checkpoint_to_json(checkpoint: CrawlCheckpoint) -> str:
    return json.dumps(
        {
            "pending": [list(item) for item in checkpoint.pending],
            "visited": list(checkpoint.visited),
            "discovered": list(checkpoint.discovered),
            "failed": list(checkpoint.failed),
            "blocked": list(checkpoint.blocked),
        },
        sort_keys=True,
        separators=(",", ":"),
    )


def checkpoint_from_json(raw: str) -> CrawlCheckpoint:
    data = json.loads(raw)
    return CrawlCheckpoint(
        pending=tuple((float(a), int(b), str(c)) for a, b, c in data.get("pending", [])),
        visited=tuple(str(x) for x in data.get("visited", [])),
        discovered=tuple(str(x) for x in data.get("discovered", [])),
        failed=tuple(str(x) for x in data.get("failed", [])),
        blocked=tuple(str(x) for x in data.get("blocked", [])),
    )
