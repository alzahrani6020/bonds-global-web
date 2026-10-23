# Imported source snapshot for BONDS adaptation.
# Source: alzahrani6020/AFAQ-GIE@b1fec7fa400c57f32c2022a21cf74039379fc3cf:afaq_agent_runtime/research_intelligence.py
# STAGING ONLY: not imported by BONDS runtime.

"""Research & Content Intelligence engine — deterministic, offline, advisory.

Turns a seed topic plus an optional caller-supplied candidate source corpus
(offline text stubs: title / publisher / kind / body) into a bounded,
validated research report: discovered sources, deterministic ranking,
authority-signal verification, fact/evidence extraction with explicit
uncertainty, and topic analysis (facets, key terms, coverage, consensus,
conflicts), grounded confidence, and honest open_questions. Pure stdlib —
no model calls, no network, no state ownership. This is an ENGINE, not a
store: it researches and reports; persistence and authority live elsewhere.

Pipeline (each step is independently callable and validated):
  discover_sources -> verify_source -> rank_sources
                   -> extract_facts -> analyze_topic -> research_topic
  run_research_gates / research_readiness seal the report.

Reuse (engine registry, dedup audit):
  - ENG-UND-017 (project_understanding) is INSTRUCTION-side: it analyzes a
    raw owner instruction before any change exists. This module is
    EVIDENCE-side: it analyzes a topic against a caller-supplied source
    corpus. No field, gate, or extractor overlaps; a topic string produced
    from an understanding's goals is a valid input here, and nothing here
    re-classifies intent or re-inspects the filesystem.
  - ENG-DEC-002 (decision_analysis) is CHANGE-side: analysis of a proposed
    change. Research reports are pre-decision evidence; no overlap.
  - No canonical component is imported: the engine is composable but
    standalone, so it can never pull authority into an advisory path.

ABSENT stays ABSENT: anything not derivable from the topic or the supplied
corpus is reported as UNKNOWN (open_questions), never fabricated. An empty
candidate corpus yields an empty, honestly-disclosed report — never invented
sources.
"""

from __future__ import annotations

import re
from typing import Any, Iterable, Mapping

# ---------------------------------------------------------------------------
# Bounded vocabulary and budgets (mirrors decision_analysis discipline).

_SOURCE_KINDS = ("official", "academic", "reference", "news", "community", "blog", "unknown")
_UNCERTAINTY_LEVELS = ("low", "medium", "high")
_CONFIDENCE_LEVELS = ("low", "medium", "high")
_COVERAGE_LEVELS = ("none", "single_source", "multi_source")
_AUTHORITY_KINDS = ("official", "academic", "reference")

_MAX_FIELD_WORDS = 40
_MAX_SOURCES = 8
_MAX_FACTS = 10
_MAX_FACETS = 5
_MAX_KEY_TERMS = 5
_MAX_CONSENSUS = 5
_MAX_CONFLICTS = 5
_MAX_OPEN_QUESTIONS = 5
_MAX_SIGNALS = 8
_MAX_TEXT_CHARS = 2000

# ---------------------------------------------------------------------------
# Deterministic extraction signals (no model, keyword/structure only).

_CLAUSE_SPLIT = re.compile(r"[.!؟?\n]+|؛|;")
_TOKEN_SPLIT = re.compile(r"[^\w]+")
_DATE = re.compile(r"\b(19|20)\d{2}\b")

# Citation wording: a sentence carrying one is treated as attributed evidence.
_CITATION_SIGNALS = (
    "according to", "study", "studies", "report", "survey", "research",
    "cited", "evidence", "وفق", "تقول", "تقرير", "أفاد", "افاد",
    "أشارت", "اشارت", "دراسة", "دراسات", "بحث", "بيانات",
)

# Definitional wording: a claim, but the weakest evidence class on its own.
_DEFINITION_SIGNALS = (
    " is ", " are ", " was ", " were ", "defined as", "known as", " refers to",
    "هو ", "هي ", "يعرف بأنه", "تعرف بأنها",
)

_NEGATION_SIGNALS = (
    "not ", " no ", "never", "n't", "without", "لا ", "ليس ", "ليست ", "لم ", "لن ",
)

# Content-token stoplist (English + Arabic function words).
_STOPWORDS = frozenset(
    "the and for with that this from into about what when where which are was were "
    "has have had will its their his her them they then than such also more most "
    "هذا هذه ذلك التي الذي الذين في من على إلى عن ما أن ان إن كان كانت يكون "
    "تم يتم بعد قبل عند كل بعض غير بين فوق تحت"
    .split()
)


class ResearchError(ValueError):
    """Bounded, user-facing research parse/quality failure."""


def _words(text: str) -> int:
    return len(text.split())


def _short(text: str, where: str) -> str:
    value = text.strip()
    if not value:
        raise ResearchError(f"research.{where} must be a non-empty string")
    if _words(value) > _MAX_FIELD_WORDS:
        raise ResearchError(
            f"research.{where} exceeds {_MAX_FIELD_WORDS} words"
        )
    return value


def _string_list(value: Any, where: str, cap: int) -> list[str]:
    if not isinstance(value, list):
        raise ResearchError(f"research.{where} must be a list")
    if len(value) > cap:
        raise ResearchError(f"research.{where} exceeds {cap} entries")
    out = []
    for item in value:
        out.append(_short(item, where))
    return out


def _tokens(text: str) -> set[str]:
    return {
        t for t in _TOKEN_SPLIT.split(text.lower())
        if len(t) >= 3 and t not in _STOPWORDS
    }


def _content_tokens(text: str) -> set[str]:
    return _tokens(text)


def _sentences(text: str) -> list[str]:
    return [
        " ".join(s.split())
        for s in _CLAUSE_SPLIT.split(text or "")
        if s.strip(" ,،\t")
    ]


def _norm_claim(text: str) -> str:
    return " ".join(text.lower().split())


def _jaccard(a: set[str], b: set[str]) -> float:
    if not a or not b:
        return 0.0
    return len(a & b) / len(a | b)


# ---------------------------------------------------------------------------
# Strict parse / validate (mirrors decision_analysis parse discipline).
# Unknown keys are ignored (forward-tolerant); required keys and enums are
# enforced; every free-text field is capped at _MAX_FIELD_WORDS words.


def _parse_verification(value: Any, where: str) -> dict[str, Any]:
    if not isinstance(value, Mapping):
        raise ResearchError(f"research.{where} must be an object")
    try:
        authority = float(value.get("authority"))
    except (TypeError, ValueError):
        raise ResearchError(f"research.{where}.authority must be a number") from None
    if not 0.0 <= authority <= 1.0:
        raise ResearchError(f"research.{where}.authority must be within 0..1")
    uncertainty = str(value.get("uncertainty", "")).strip()
    if uncertainty not in _UNCERTAINTY_LEVELS:
        raise ResearchError(
            f"research.{where}.uncertainty must be one of {_UNCERTAINTY_LEVELS}"
        )
    return {
        "authority": authority,
        "signals": _string_list(value.get("signals"), f"{where}.signals", _MAX_SIGNALS),
        "uncertainty": uncertainty,
    }


def _parse_source(value: Any, index: int) -> dict[str, Any]:
    where = f"sources[{index}]"
    if not isinstance(value, Mapping):
        raise ResearchError(f"research.{where} must be an object")
    source: dict[str, Any] = {
        "id": _short(str(value.get("id", "")), f"{where}.id"),
        "title": _short(str(value.get("title", "")), f"{where}.title"),
        "publisher": _short(str(value.get("publisher", "")), f"{where}.publisher"),
    }
    kind = str(value.get("kind", "")).strip().lower()
    if kind not in _SOURCE_KINDS:
        raise ResearchError(
            f"research.{where}.kind must be one of {_SOURCE_KINDS}"
        )
    source["kind"] = kind
    text = str(value.get("text", ""))
    if len(text) > _MAX_TEXT_CHARS:
        raise ResearchError(
            f"research.{where}.text exceeds {_MAX_TEXT_CHARS} characters"
        )
    source["text"] = text
    for optional in ("author", "published"):
        if value.get(optional) is not None:
            source[optional] = _short(str(value[optional]), f"{where}.{optional}")
    source["verification"] = _parse_verification(
        value.get("verification"), f"{where}.verification"
    )
    return source


def _parse_fact(value: Any, index: int) -> dict[str, Any]:
    where = f"facts[{index}]"
    if not isinstance(value, Mapping):
        raise ResearchError(f"research.{where} must be an object")
    uncertainty = str(value.get("uncertainty", "")).strip()
    if uncertainty not in _UNCERTAINTY_LEVELS:
        raise ResearchError(
            f"research.{where}.uncertainty must be one of {_UNCERTAINTY_LEVELS}"
        )
    return {
        "claim": _short(str(value.get("claim", "")), f"{where}.claim"),
        "source_id": _short(str(value.get("source_id", "")), f"{where}.source_id"),
        "evidence": _short(str(value.get("evidence", "")), f"{where}.evidence"),
        "uncertainty": uncertainty,
    }


def _parse_analysis(value: Any) -> dict[str, Any]:
    if not isinstance(value, Mapping):
        raise ResearchError("research.analysis must be an object")
    required = ("facets", "key_terms", "coverage", "consensus", "conflicts")
    missing = [k for k in required if k not in value]
    if missing:
        raise ResearchError(
            f"research.analysis missing required field(s): {missing}"
        )
    coverage = str(value.get("coverage", "")).strip()
    if coverage not in _COVERAGE_LEVELS:
        raise ResearchError(
            f"research.analysis.coverage must be one of {_COVERAGE_LEVELS}"
        )
    return {
        "facets": _string_list(value.get("facets"), "analysis.facets", _MAX_FACETS),
        "key_terms": _string_list(
            value.get("key_terms"), "analysis.key_terms", _MAX_KEY_TERMS
        ),
        "coverage": coverage,
        "consensus": _string_list(
            value.get("consensus"), "analysis.consensus", _MAX_CONSENSUS
        ),
        "conflicts": _string_list(
            value.get("conflicts"), "analysis.conflicts", _MAX_CONFLICTS
        ),
    }


def parse_research_report(payload: Any) -> dict[str, Any]:
    """Validate and normalize a research report object.

    Raises ResearchError with a specific reason. Unknown keys are ignored;
    required keys and enums are enforced; every free-text field is capped at
    _MAX_FIELD_WORDS words. Cross-field consistency (fact->source grounding,
    coverage agreement, basis grounding) is the GATE's job, not the parser's.
    """
    if not isinstance(payload, Mapping):
        raise ResearchError("research must be a JSON object")
    required = ("topic", "sources", "facts", "analysis", "confidence", "open_questions")
    missing = [k for k in required if k not in payload]
    if missing:
        raise ResearchError(
            f"research missing required field(s): {missing}"
        )

    report: dict[str, Any] = {}
    report["topic"] = _short(str(payload.get("topic", "")), "topic")

    sources = payload.get("sources")
    if not isinstance(sources, list):
        raise ResearchError("research.sources must be a list")
    if len(sources) > _MAX_SOURCES:
        raise ResearchError(f"research.sources exceeds {_MAX_SOURCES} entries")
    report["sources"] = [_parse_source(s, i) for i, s in enumerate(sources)]

    facts = payload.get("facts")
    if not isinstance(facts, list):
        raise ResearchError("research.facts must be a list")
    if len(facts) > _MAX_FACTS:
        raise ResearchError(f"research.facts exceeds {_MAX_FACTS} entries")
    report["facts"] = [_parse_fact(f, i) for i, f in enumerate(facts)]

    report["analysis"] = _parse_analysis(payload.get("analysis"))

    confidence = payload.get("confidence")
    if not isinstance(confidence, Mapping):
        raise ResearchError("research.confidence must be an object")
    level = str(confidence.get("level", "")).strip()
    if level not in _CONFIDENCE_LEVELS:
        raise ResearchError(
            f"research.confidence.level must be one of {_CONFIDENCE_LEVELS}"
        )
    report["confidence"] = {
        "level": level,
        "basis": _short(str(confidence.get("basis", "")), "confidence.basis"),
    }

    report["open_questions"] = _string_list(
        payload.get("open_questions"), "open_questions", _MAX_OPEN_QUESTIONS
    )
    return report


# ---------------------------------------------------------------------------
# 1. Source discovery: classify caller-supplied candidate stubs against the
#    seed topic. Offline by construction — the corpus is an argument.

def _relevance(topic: str, text: str) -> int:
    """Deterministic 0..100 token-overlap relevance (dice coefficient)."""
    topic_tokens = _tokens(topic)
    doc_tokens = _tokens(text)
    if not topic_tokens or not doc_tokens:
        return 0
    overlap = len(topic_tokens & doc_tokens)
    return round(100 * (2 * overlap) / (len(topic_tokens) + len(doc_tokens)))


def discover_sources(
    topic: str,
    candidates: Iterable[Mapping[str, Any]] | None = None,
    limit: int = _MAX_SOURCES,
) -> list[dict[str, Any]]:
    """Classify candidate source stubs by relevance to the seed topic.

    Deterministic and offline: candidates are caller-supplied mappings with
    optional id/title/publisher/kind/text. Unknown kinds normalize to
    "unknown" (lenient intake); only candidates sharing at least one content
    token with the topic are discovered; ordering is (-relevance, id) so the
    result is stable. An empty/absent corpus yields [] — never fabricated.
    """
    topic = (topic or "").strip()
    discovered: list[dict[str, Any]] = []
    for index, candidate in enumerate(candidates or []):
        if not isinstance(candidate, Mapping):
            continue
        title = " ".join(str(candidate.get("title", "")).split())
        text = str(candidate.get("text", ""))[:_MAX_TEXT_CHARS]
        kind = str(candidate.get("kind", "unknown")).strip().lower()
        if kind not in _SOURCE_KINDS:
            kind = "unknown"
        source = {
            "id": str(candidate.get("id") or f"src-{index + 1}"),
            "title": title,
            "publisher": " ".join(str(candidate.get("publisher", "unknown")).split())
            or "unknown",
            "kind": kind,
            "text": text,
        }
        if candidate.get("author"):
            source["author"] = " ".join(str(candidate["author"]).split())
        if candidate.get("published"):
            source["published"] = str(candidate["published"])
        source["relevance"] = _relevance(topic, f"{title} {text}")
        if source["relevance"] > 0:
            discovered.append(source)
    discovered.sort(key=lambda s: (-s["relevance"], s["id"]))
    return discovered[:limit]


# ---------------------------------------------------------------------------
# 2. Source verification: authority signals, all inspectable metadata.

def verify_source(
    source: Mapping[str, Any],
    corpus: Iterable[str] = (),
) -> dict[str, Any]:
    """Score source authority from deterministic metadata/text signals.

    Signals (each is inspectable, none is fabricated):
      publisher      — a named publisher is present (not "unknown")
      author         — a named author is present
      date           — a year (19xx/20xx) appears in metadata/text
      citations      — citation wording appears in the body (0.5 each, max 2)
      numeric_data   — the body carries numeric data
      authority_kind — kind is official/academic/reference
      cross_referenced — the title is mentioned in another corpus text
    authority = min(1, weighted_sum/10); uncertainty low>=0.7, medium>=0.4,
    else high. Returns a copy — the input is never mutated.
    """
    if not isinstance(source, Mapping):
        raise ResearchError("research.verify_source expects a source object")
    out = dict(source)
    publisher = str(source.get("publisher", "")).strip().lower()
    title = str(source.get("title", ""))
    text = str(source.get("text", ""))
    kind = str(source.get("kind", "unknown")).strip().lower()

    score = 0.0
    signals: list[str] = []
    if publisher and publisher != "unknown":
        score += 2.0
        signals.append("publisher")
    if str(source.get("author", "")).strip():
        score += 1.5
        signals.append("author")
    if _DATE.search(f"{source.get('published', '')} {text}"):
        score += 1.0
        signals.append("date")
    citation_hits = sum(1 for c in _CITATION_SIGNALS if c in text.lower())
    if citation_hits:
        score += min(2.0, 0.5 * citation_hits)
        signals.append("citations")
    if any(ch.isdigit() for ch in text):
        score += 1.0
        signals.append("numeric_data")
    if kind in _AUTHORITY_KINDS:
        score += 2.0
        signals.append("authority_kind")
    title_tokens = _tokens(title)
    others = " ".join(corpus)
    if title_tokens and others and title_tokens & _tokens(others):
        score += 1.0
        signals.append("cross_referenced")

    authority = round(min(1.0, score / 10.0), 2)
    uncertainty = "low" if authority >= 0.7 else "medium" if authority >= 0.4 else "high"
    out["verification"] = {
        "authority": authority,
        "signals": signals[:_MAX_SIGNALS],
        "uncertainty": uncertainty,
    }
    return out


# ---------------------------------------------------------------------------
# 3. Source ranking: relevance and verified authority, deterministic order.

def rank_sources(
    sources: Iterable[Mapping[str, Any]],
    topic: str,
) -> list[dict[str, Any]]:
    """Rank verified sources: 0.6*relevance + 0.4*authority*100.

    Ties break by (-relevance, id) so ordering is fully deterministic.
    Returns copies with rank_score/rank attached; input order is irrelevant.
    """
    scored: list[dict[str, Any]] = []
    for source in sources or []:
        if not isinstance(source, Mapping):
            continue
        out = dict(source)
        relevance = int(source.get("relevance", 0))
        verification = source.get("verification") or {}
        try:
            authority = float(verification.get("authority", 0.0))
        except (TypeError, ValueError):
            authority = 0.0
        out["rank_score"] = round(0.6 * relevance + 0.4 * max(0.0, min(1.0, authority)) * 100)
        scored.append(out)
    scored.sort(key=lambda s: (-s["rank_score"], -int(s.get("relevance", 0)), str(s.get("id", ""))))
    for position, source in enumerate(scored):
        source["rank"] = position + 1
    return scored


# ---------------------------------------------------------------------------
# 4. Fact / evidence extraction with explicit uncertainty.

def _claim_uncertainty(sentence: str) -> str | None:
    """Classify one sentence; None means no claim signal at all.

    low    — numeric data AND citation wording (attributed, checkable)
    medium — numeric data OR citation wording
    high   — definitional wording only (the weakest evidence class)
    """
    lowered = sentence.lower()
    numeric = any(ch.isdigit() for ch in sentence)
    # Latin signals match on word boundaries ("source" must not fire inside
    # "renewable source"); Arabic signals match as substrings so inflected
    # forms (وفقاً) still count.
    cited = any(
        re.search(rf"\b{re.escape(c)}\b", lowered)
        if c.isascii()
        else c in lowered
        for c in _CITATION_SIGNALS
    )
    if numeric and cited:
        return "low"
    if numeric or cited:
        return "medium"
    if any(d in lowered for d in _DEFINITION_SIGNALS):
        return "high"
    return None


def extract_facts(
    sources: Iterable[Mapping[str, Any]],
    topic: str = "",
    limit: int = _MAX_FACTS,
) -> list[dict[str, Any]]:
    """Extract bounded, de-duplicated claims with explicit uncertainty.

    Sentences are scanned in source order; only sentences carrying a claim
    signal are kept; the claim text and its evidence quote are the same
    bounded sentence (honest extraction — nothing is paraphrased). Topic
    overlap acts as a deterministic promotion key: claims sharing a content
    token with the topic rank first; within a tier, source order is kept.
    """
    topic_tokens = _tokens(topic)
    facts: list[dict[str, Any]] = []
    seen: set[str] = set()
    for source in sources or []:
        if not isinstance(source, Mapping):
            continue
        source_id = str(source.get("id", ""))
        for sentence in _sentences(str(source.get("text", ""))):
            if _words(sentence) > _MAX_FIELD_WORDS:
                sentence = " ".join(sentence.split()[:_MAX_FIELD_WORDS])
            uncertainty = _claim_uncertainty(sentence)
            if uncertainty is None:
                continue
            key = _norm_claim(sentence)
            if key in seen:
                continue
            seen.add(key)
            overlap = len(_tokens(sentence) & topic_tokens)
            facts.append({
                "claim": sentence,
                "source_id": source_id,
                "evidence": sentence,
                "uncertainty": uncertainty,
                "_overlap": overlap,
                "_order": len(facts),
            })
    facts.sort(key=lambda f: (-f["_overlap"], f["_order"]))
    for fact in facts:
        del fact["_overlap"], fact["_order"]
    return facts[:limit]


# ---------------------------------------------------------------------------
# 5. Topic analysis: facets, key terms, coverage, consensus, conflicts.

def _negated(sentence: str) -> bool:
    lowered = f" {sentence.lower()} "
    return any(n in lowered for n in _NEGATION_SIGNALS)


def analyze_topic(
    topic: str,
    sources: Iterable[Mapping[str, Any]],
    facts: Iterable[Mapping[str, Any]],
) -> dict[str, Any]:
    """Deterministic topic analysis over the extracted evidence.

    facets   — significant content tokens of the topic (the sub-angles the
               corpus can actually speak to); [topic] as an honest fallback
    key_terms — highest-frequency content tokens across the corpus
    coverage — none / single_source / multi_source by fact source spread
    consensus — claims corroborated (Jaccard >= 0.5) by another source
    conflicts — claims from different sources, Jaccard >= 1/3, opposed
                polarity (one negated, one not)
    """
    topic = (topic or "").strip()
    fact_list = [f for f in (facts or []) if isinstance(f, Mapping)]
    source_list = [s for s in (sources or []) if isinstance(s, Mapping)]

    topic_tokens = _tokens(topic)
    facets = sorted(topic_tokens)[:_MAX_FACETS] or ([topic] if topic else [])

    counts: dict[str, int] = {}
    for source in source_list:
        for token in _tokens(str(source.get("text", ""))):
            counts[token] = counts.get(token, 0) + 1
    key_terms = sorted(counts, key=lambda t: (-counts[t], t))[:_MAX_KEY_TERMS]

    fact_sources = {str(f.get("source_id", "")) for f in fact_list if f.get("source_id")}
    coverage = "none" if not fact_sources else (
        "single_source" if len(fact_sources) == 1 else "multi_source"
    )

    fact_tokens = [
        (f, _content_tokens(str(f.get("claim", ""))))
        for f in fact_list
    ]
    consensus: list[str] = []
    conflicts: list[str] = []
    for i, (fa, ta) in enumerate(fact_tokens):
        if not ta:
            continue
        for fb, tb in fact_tokens[i + 1:]:
            if not tb or fa.get("source_id") == fb.get("source_id"):
                continue
            jac = _jaccard(ta, tb)
            if jac >= 0.5 and len(consensus) < _MAX_CONSENSUS:
                consensus.append(
                    f"2 sources agree: {str(fa.get('claim', ''))[:60]}"
                )
            elif jac >= 1 / 3 and _negated(str(fa.get("claim", ""))) != _negated(str(fb.get("claim", ""))) and len(conflicts) < _MAX_CONFLICTS:
                conflicts.append(
                    f"conflict: '{str(fa.get('claim', ''))[:50]}' vs '{str(fb.get('claim', ''))[:50]}'"
                )

    return {
        "facets": facets,
        "key_terms": key_terms,
        "coverage": coverage,
        "consensus": consensus[:_MAX_CONSENSUS],
        "conflicts": conflicts[:_MAX_CONFLICTS],
    }


# ---------------------------------------------------------------------------
# End-to-end pipeline + grounded confidence + honest open questions.

def _report_confidence(sources: list[dict[str, Any]],
                       facts: list[dict[str, Any]], topic: str) -> dict[str, str]:
    usable = sum(
        1 for s in sources
        if s.get("verification", {}).get("uncertainty") in ("low", "medium")
    )
    low_facts = sum(1 for f in facts if f.get("uncertainty") == "low")
    if usable >= 2 and low_facts >= 1:
        level = "high"
    elif usable >= 1 or facts:
        level = "medium"
    else:
        level = "low"
    topic_words = topic.split()
    basis = f'topic states: "{" ".join(topic_words[:12])}"'
    if sources:
        first = sources[0]
        basis += f"; best source: {first.get('title', '?')} ({first.get('publisher', '?')})"
    basis = " ".join(basis.split()[:_MAX_FIELD_WORDS])
    return {"level": level, "basis": basis}


def research_topic(
    topic: str,
    candidates: Iterable[Mapping[str, Any]] | None = None,
) -> dict[str, Any]:
    """Run the full deterministic pipeline for a seed topic.

    discover -> verify -> rank -> extract facts -> analyze -> validate.
    The returned report always passes parse_research_report; anything not
    derivable from topic + corpus lands in open_questions as UNKNOWN.
    """
    topic = (topic or "").strip()
    if not topic:
        raise ResearchError("research.topic must be a non-empty string")
    if _words(topic) > _MAX_FIELD_WORDS:
        topic = " ".join(topic.split()[:_MAX_FIELD_WORDS])

    discovered = discover_sources(topic, candidates)
    texts = [str(s.get("text", "")) for s in discovered]
    verified = [
        verify_source(s, corpus=[t for j, t in enumerate(texts) if j != i])
        for i, s in enumerate(discovered)
    ]
    ranked = rank_sources(verified, topic)
    facts = extract_facts(ranked, topic)
    analysis = analyze_topic(topic, ranked, facts)
    confidence = _report_confidence(ranked, facts, topic)

    open_questions: list[str] = []
    if not discovered:
        open_questions.append("sources UNKNOWN — no relevant candidate sources in corpus")
    elif all(s.get("verification", {}).get("uncertainty") == "high" for s in ranked):
        open_questions.append("authority UNKNOWN — no source passed verification")
    if not facts:
        open_questions.append("facts UNKNOWN — no extractable claims in the corpus")
    if len(_tokens(topic)) < 2:
        open_questions.append("topic narrow — single-term topic limits facet analysis")

    return parse_research_report({
        "topic": topic,
        "sources": ranked,
        "facts": facts,
        "analysis": analysis,
        "confidence": confidence,
        "open_questions": open_questions[:_MAX_OPEN_QUESTIONS],
    })


# ---------------------------------------------------------------------------
# Deterministic consistency gates over the report + the topic it claims to
# cover. Failures are reasons (empty = pass); nothing here weakens or
# replaces canonical validation.

def run_research_gates(
    report: Mapping[str, Any],
    topic: str,
) -> list[str]:
    """Consistency gates: every fact cites a real source and is grounded in
    that source's text; no duplicate claims; confidence basis is grounded in
    the topic or a source; coverage agrees with the fact source spread."""
    failures: list[str] = []
    if not isinstance(report, Mapping):
        return ["report must be an object"]
    sources = report.get("sources", [])
    facts = report.get("facts", [])

    source_by_id: dict[str, Mapping[str, Any]] = {}
    for source in sources:
        if isinstance(source, Mapping):
            source_by_id.setdefault(str(source.get("id", "")), source)

    claims_seen: set[str] = set()
    for fact in facts:
        if not isinstance(fact, Mapping):
            failures.append("fact entry is not an object")
            continue
        source_id = str(fact.get("source_id", ""))
        source = source_by_id.get(source_id)
        if source is None:
            failures.append(f"fact cites unknown source '{source_id[:30]}'")
        else:
            claim_tokens = _tokens(str(fact.get("claim", "")))
            source_tokens = _tokens(str(source.get("text", "")))
            if claim_tokens and source_tokens and not (claim_tokens & source_tokens):
                failures.append(
                    f"claim '{str(fact.get('claim', ''))[:40]}' is not grounded in its source text"
                )
        key = _norm_claim(str(fact.get("claim", "")))
        if key in claims_seen:
            failures.append(f"duplicate claim '{str(fact.get('claim', ''))[:40]}'")
        claims_seen.add(key)

    basis = str(report.get("confidence", {}).get("basis", "")).lower()
    topic_token = next(
        (t for t in _tokens(topic or str(report.get("topic", ""))) if len(t) >= 3),
        None,
    )
    grounded = bool(topic_token and topic_token in basis)
    if not grounded:
        for source in sources:
            if not isinstance(source, Mapping):
                continue
            for token in _tokens(f"{source.get('title', '')} {source.get('publisher', '')}"):
                if len(token) >= 4 and token in basis:
                    grounded = True
                    break
            if grounded:
                break
    if not grounded:
        failures.append(
            "confidence basis is not grounded in the topic or any source"
        )

    coverage = str(report.get("analysis", {}).get("coverage", ""))
    fact_sources = {
        str(f.get("source_id", ""))
        for f in facts
        if isinstance(f, Mapping) and f.get("source_id")
    }
    actual = "none" if not fact_sources else (
        "single_source" if len(fact_sources) == 1 else "multi_source"
    )
    if coverage and coverage != actual:
        failures.append(
            f"analysis.coverage '{coverage}' disagrees with fact source spread '{actual}'"
        )

    return failures


def research_readiness(
    report: Mapping[str, Any],
    gate_failures: list[str],
) -> dict[str, Any]:
    """Research readiness seal. READY requires clean gates, at least one
    verified source, and at least one extracted fact — a research report
    without evidence is a report of nothing."""
    blocking = list(gate_failures)
    if not isinstance(report, Mapping):
        return {
            "ready": False,
            "blocking_items": blocking + ["report must be an object"],
            "seal": {"authority_preserved": True},
        }
    sources = report.get("sources", [])
    verified = any(
        isinstance(s, Mapping)
        and s.get("verification", {}).get("uncertainty") in ("low", "medium")
        for s in sources
    )
    if not verified:
        blocking.append("no verified source — research insufficient")
    if not report.get("facts"):
        blocking.append("no extracted facts — research insufficient")
    ready = not blocking
    return {
        "ready": ready,
        "blocking_items": blocking,
        "seal": {
            "sources_verified": verified,
            "facts_extracted": bool(report.get("facts")),
            "gates_clean": not gate_failures,
            "basis_grounded": bool(report.get("confidence", {}).get("basis")),
            "uncertainties_disclosed": bool(report.get("open_questions")),
            "authority_preserved": True,  # advisory engine only
        },
    }
