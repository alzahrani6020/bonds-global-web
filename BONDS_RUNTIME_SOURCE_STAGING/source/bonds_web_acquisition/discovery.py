# Imported source snapshot for BONDS adaptation.
# Source: alzahrani6020/AFAQ-GIE@b1fec7fa400c57f32c2022a21cf74039379fc3cf:web_acquisition/discovery.py
# STAGING ONLY: not imported by BONDS runtime.

"""HTML and platform-surface discovery for external acquisition."""

from __future__ import annotations

import re
import urllib.parse
from html.parser import HTMLParser
from typing import Iterable

_SURFACE_PATTERNS = (
    ("api", ("api", "openapi", "swagger", "graphql")),
    ("sdk", ("sdk", "client library", "npm", "pypi", "github")),
    ("docs", ("docs", "documentation", "developer", "guide", "reference")),
    ("pricing", ("pricing", "plans", "billing")),
    ("changelog", ("changelog", "release notes", "releases", "what's new")),
    ("status", ("status", "uptime", "incident")),
    ("auth", ("oauth", "authentication", "authorization", "api key", "sso")),
    ("limits", ("rate limit", "quota", "limits")),
    ("webhooks", ("webhook", "callback")),
    ("models", ("models", "model card", "inference")),
    ("policies", ("privacy", "terms", "legal", "security")),
)

_ROUTE_PATTERNS = (
    re.compile(r'["\'](https?://[^"\']+)["\']', re.I),
    re.compile(r'["\'](/(?:api|v\d+|graphql|oauth|auth|webhooks?)[^"\']*)["\']', re.I),
)


class SurfaceParser(HTMLParser):
    def __init__(self, base_url: str) -> None:
        super().__init__(convert_charrefs=True)
        self.base_url = base_url
        self.links: list[str] = []
        self.scripts: list[str] = []
        self.feeds: list[str] = []
        self.title_parts: list[str] = []
        self._in_title = False
        self._text: list[str] = []

    def handle_starttag(self, tag: str, attrs):  # noqa: ANN001
        data = {str(k).lower(): str(v) for k, v in attrs if k and v is not None}
        if tag.lower() == "a" and data.get("href"):
            self.links.append(urllib.parse.urljoin(self.base_url, data["href"]))
        elif tag.lower() == "script" and data.get("src"):
            self.scripts.append(urllib.parse.urljoin(self.base_url, data["src"]))
        elif tag.lower() == "link":
            rel = data.get("rel", "").lower()
            typ = data.get("type", "").lower()
            href = data.get("href")
            if href and ("alternate" in rel or "application/rss" in typ or "application/atom" in typ):
                self.feeds.append(urllib.parse.urljoin(self.base_url, href))
        elif tag.lower() == "title":
            self._in_title = True

    def handle_endtag(self, tag: str) -> None:
        if tag.lower() == "title":
            self._in_title = False

    def handle_data(self, data: str) -> None:
        if self._in_title:
            self.title_parts.append(data.strip())
        if data.strip():
            self._text.append(data.strip())

    @property
    def title(self) -> str | None:
        value = " ".join(x for x in self.title_parts if x).strip()
        return value or None

    @property
    def text(self) -> str:
        return " ".join(self._text)


def normalize_http_url(url: str) -> str | None:
    parsed = urllib.parse.urlsplit(url)
    if parsed.scheme.lower() not in {"http", "https"}:
        return None
    if not parsed.hostname:
        return None
    path = parsed.path or "/"
    normalized = parsed._replace(fragment="", path=path)
    return urllib.parse.urlunsplit(normalized)


def same_site(seed_host: str, candidate_host: str, *, allow_subdomains: bool) -> bool:
    seed = seed_host.lower().strip(".")
    candidate = candidate_host.lower().strip(".")
    if candidate == seed:
        return True
    return bool(allow_subdomains and candidate.endswith("." + seed))


def discover_surfaces(text: str, links: Iterable[str]) -> tuple[str, ...]:
    blob = text.lower()
    joined_links = " ".join(links).lower()
    found = {
        surface
        for surface, needles in _SURFACE_PATTERNS
        if any(needle in blob or needle in joined_links for needle in needles)
    }
    return tuple(sorted(found))


def semantic_hints(text: str, mission_terms: tuple[str, ...]) -> tuple[str, ...]:
    lowered = text.lower()
    hits = [term for term in mission_terms if term and term.lower() in lowered]
    return tuple(sorted(dict.fromkeys(hits)))


def infer_render_required(html: str) -> bool:
    lower = html.lower()
    signals = (
        "__next_data__",
        'id="__next"',
        'id="root"',
        "webpack",
        "vite",
        "react",
        "angular",
        "vue",
        "hydration",
    )
    body_text = re.sub(r"<[^>]+>", " ", lower)
    sparse_text = len(re.sub(r"\s+", " ", body_text).strip()) < 200
    return any(signal in lower for signal in signals) and sparse_text


def discover_embedded_routes(html: str, base_url: str) -> tuple[str, ...]:
    routes: list[str] = []
    for pattern in _ROUTE_PATTERNS:
        for match in pattern.findall(html):
            candidate = urllib.parse.urljoin(base_url, match)
            normalized = normalize_http_url(candidate)
            if normalized:
                routes.append(normalized)
    return tuple(sorted(dict.fromkeys(routes)))


def parse_html(base_url: str, html: str, mission_terms: tuple[str, ...] = ()):
    parser = SurfaceParser(base_url)
    try:
        parser.feed(html)
    except Exception:
        pass

    links = []
    for value in (*parser.links, *parser.scripts, *parser.feeds, *discover_embedded_routes(html, base_url)):
        normalized = normalize_http_url(value)
        if normalized:
            links.append(normalized)

    unique_links = tuple(sorted(dict.fromkeys(links)))
    text = parser.text
    return {
        "title": parser.title,
        "links": unique_links,
        "surfaces": discover_surfaces(text, unique_links),
        "semantic_hints": semantic_hints(text, mission_terms),
        "render_required": infer_render_required(html),
    }


def parse_sitemap(xml_text: str, base_url: str) -> tuple[str, ...]:
    urls = []
    for raw in re.findall(r"<loc>\s*([^<]+?)\s*</loc>", xml_text, re.I):
        normalized = normalize_http_url(urllib.parse.urljoin(base_url, raw.strip()))
        if normalized:
            urls.append(normalized)
    return tuple(sorted(dict.fromkeys(urls)))


def parse_robots_sitemaps(text: str, base_url: str) -> tuple[str, ...]:
    urls = []
    for line in text.splitlines():
        if ":" not in line:
            continue
        key, value = line.split(":", 1)
        if key.strip().lower() != "sitemap":
            continue
        normalized = normalize_http_url(urllib.parse.urljoin(base_url, value.strip()))
        if normalized:
            urls.append(normalized)
    return tuple(sorted(dict.fromkeys(urls)))
