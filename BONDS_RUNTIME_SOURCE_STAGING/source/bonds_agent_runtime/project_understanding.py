# Imported source snapshot for BONDS adaptation.
# Source: alzahrani6020/AFAQ-GIE@b1fec7fa400c57f32c2022a21cf74039379fc3cf:afaq_agent_runtime/project_understanding.py
# STAGING ONLY: not imported by BONDS runtime.

"""Project Understanding engine — deterministic, offline, advisory.

Turns a raw owner instruction (plus an optional repository map from
repository_mapper.map_repository) into a bounded, validated understanding:
intent, named goals, audience, platform hints, constraints, deliverables, a
deterministic task decomposition, grounded confidence, and honest
open_questions. Pure stdlib — no model calls, no network, no state
ownership. This is an ENGINE, not a store: it understands and reports;
persistence and authority live elsewhere.

Reuse (engine registry, dedup audit):
  - intent comes from intent_gate.classify_intent — never reclassified here.
  - platform hints extend repository_mapper project_types — the mapper
    remains the only filesystem inspector.
  - decision_analysis is the CHANGE-side twin (analysis of a proposed
    change); this module is the UNDERSTANDING-side engine (analysis of the
    instruction before any change exists). No field or gate overlaps.

ABSENT stays ABSENT: anything not derivable from the instruction or the
repo map is reported as UNKNOWN (open_questions), never fabricated.
"""

from __future__ import annotations

import re
from typing import Any, Mapping

from .intent_gate import (
    ANALYSIS,
    CLARIFICATION_REQUIRED,
    CONVERSATION,
    DEVELOPMENT_TASK,
    SELF_STATUS,
    classify_intent,
    extract_file_paths,
)

# ---------------------------------------------------------------------------
# Bounded vocabulary and budgets (mirrors decision_analysis discipline).

_AUDIENCES = ("internal", "owner", "technical", "general", "unknown")
_CONFIDENCE_LEVELS = ("high", "medium", "low")
_INTENT_KINDS = (
    DEVELOPMENT_TASK, CONVERSATION, CLARIFICATION_REQUIRED, SELF_STATUS, ANALYSIS,
)

_MAX_FIELD_WORDS = 40
_MAX_GOALS = 3
_MAX_CONSTRAINTS = 3
_MAX_DELIVERABLES = 3
_MAX_STEPS = 5
_MAX_HINTS = 5
_MAX_OPEN_QUESTIONS = 5
_MIN_STEPS = 2

# ---------------------------------------------------------------------------
# Deterministic extraction signals (no model, keyword/structure only).

# A clause becomes a goal candidate when it carries explicit intent wording.
_GOAL_SIGNAL = re.compile(
    r"(?:أريد|اريد|أبغى|ابغى|نريد|نبغي|الهدف|هدفنا|هدفي|"
    r"\bi want\b|\bwe want\b|\bwe need\b|\bi need\b|\bgoal\b|\bin order to\b|"
    r"add\b|implement\b|create\b|build\b|fix\b|update\b|remove\b|write\b|"
    r"refactor\b|support\b|enable\b|"
    r"أضف|اضف|أنشئ|انشئ|أصلح|اصلح|عدل|عدّل|اكتب|احذف|حدث|طور|طوّر|أضفِ)",
    re.IGNORECASE,
)

# Audience wording, first match wins (owner > internal > technical > general).
_AUDIENCE_PATTERNS = (
    ("owner", (r"\bowner\b", r"صاحب", r"المالك", r"للمالك", r"مالك")),
    ("internal", (r"\binternal\b", r"الفريق", r"فريقنا", r"للفريق", r"\bteam\b")),
    ("technical", (r"developer", r"مطور", r"technical", r"تقني", r"engineer", r"مهندس")),
    ("general", (r"\busers?\b", r"المستخدمين", r"مستخدمي", r"عملاء", r"customer", r"\bpublic\b", r"عامة")),
)

# Platform hints detectable in the instruction text itself.
_PLATFORM_TEXT_PATTERNS = (
    ("nextjs", r"\bnext\.?js\b"),
    ("react", r"\breact\b"),
    ("node", r"\bnode\b|\bnodejs\b|\bnpm\b|\bjavascript\b"),
    ("typescript", r"\btypescript\b|\btsx?\b"),
    ("python", r"\bpython\b|\bpytest\b|\bdjango\b|\bfastapi\b"),
    ("api", r"\bapi\b"),
    ("web", r"\bweb\b|\bwebapp\b|\bصفحة\b|\bموقع\b"),
    ("mobile", r"\bmobile\b|\bandroid\b|\bios\b|\bflutter\b"),
    ("database", r"\bdatabase\b|\bpostgres\b|\bsqlite\b|\bقاعدة\s*بيانات\b"),
)

# Constraint families: deadline / budget / scope. A matched clause is kept
# whole (bounded to the word cap) so the constraint stays readable.
_CONSTRAINT_PATTERNS = (
    re.compile(
        r"(?:deadline|due\b|بموعد|موعد\s+التسليم|قبل\s+\d|خلال\s+\d+\s*"
        r"(?:يوم|أسبوع|شهر|يومين)|within\s+\d+\s*(?:day|week|month)|"
        r"by\s+(?:end\s+of\s+)?\w+\s+\d{1,2})",
        re.IGNORECASE,
    ),
    re.compile(
        r"(?:budget|ميزانية|تكلفة|\bcost\b|\$\s?\d|دولار|ريال)",
        re.IGNORECASE,
    ),
    re.compile(
        r"(?:scope|نطاق|\bonly\b|\bfocus\b|فقط|حصرا|دون\s+\w+|\bwithout\b\s+\w+|"
        r"out of scope|خارج\s+النطاق)",
        re.IGNORECASE,
    ),
)

# A clause becomes a deliverable candidate on explicit product wording.
_DELIVERABLE_SIGNAL = re.compile(
    r"(?:deliverable|تسليم|تسلّم|تقرير|report|document|توثيق|وثيقة|documentation|"
    r"\bapi\b|endpoint|صفحة|page|dashboard|لوحة|release|نسخة|مكتبة|library|"
    r"module|موديول|إضافة|ميزة|feature|fix|إصلاح)",
    re.IGNORECASE,
)

_CLAUSE_SPLIT = re.compile(r"[.!؟?\n]+|؛|;")


class UnderstandingError(ValueError):
    """Bounded, user-facing understanding parse/quality failure."""


def _words(text: str) -> int:
    return len(text.split())


def _short(text: str, where: str) -> str:
    value = text.strip()
    if not value:
        raise UnderstandingError(f"understanding.{where} must be a non-empty string")
    if _words(value) > _MAX_FIELD_WORDS:
        raise UnderstandingError(
            f"understanding.{where} exceeds {_MAX_FIELD_WORDS} words"
        )
    return value


def _string_list(value: Any, where: str, cap: int) -> list[str]:
    if not isinstance(value, list):
        raise UnderstandingError(f"understanding.{where} must be a list")
    if len(value) > cap:
        raise UnderstandingError(f"understanding.{where} exceeds {cap} entries")
    out = []
    for item in value:
        out.append(_short(item, where))
    return out


def _clauses(text: str) -> list[str]:
    return [c.strip(" ,،\t") for c in _CLAUSE_SPLIT.split(text or "") if c.strip(" ,،\t")]


def _bounded_clauses(candidates: list[str], cap: int) -> list[str]:
    out: list[str] = []
    seen: set[str] = set()
    for clause in candidates:
        clause = re.sub(r"\s+", " ", clause).strip()
        if not clause:
            continue
        words = clause.split()
        if len(words) > _MAX_FIELD_WORDS:
            clause = " ".join(words[:_MAX_FIELD_WORDS])
        key = clause.lower()
        if key in seen:
            continue
        seen.add(key)
        out.append(clause)
        if len(out) >= cap:
            break
    return out


def _tokens(text: str) -> set[str]:
    return {t for t in re.split(r"[^\w]+", text.lower()) if len(t) >= 3}


def parse_understanding(payload: Any) -> dict[str, Any]:
    """Validate and normalize an understanding object.

    Raises UnderstandingError with a specific reason. Unknown keys are
    ignored (forward-tolerant); required keys and enums are enforced; every
    free-text field is capped at _MAX_FIELD_WORDS words. Mirrors the
    decision_analysis parse discipline on the understanding side.
    """
    if not isinstance(payload, Mapping):
        raise UnderstandingError("understanding must be a JSON object")
    required = (
        "intent", "goals", "audience", "platform_hints", "constraints",
        "deliverables", "decomposition", "confidence", "open_questions",
    )
    missing = [k for k in required if k not in payload]
    if missing:
        raise UnderstandingError(
            f"understanding missing required field(s): {missing}"
        )

    understanding: dict[str, Any] = {}

    intent = payload.get("intent")
    if not isinstance(intent, Mapping):
        raise UnderstandingError("understanding.intent must be an object")
    kind = str(intent.get("kind", "")).strip()
    if kind not in _INTENT_KINDS:
        raise UnderstandingError(
            f"understanding.intent.kind must be one of {_INTENT_KINDS}"
        )
    understanding["intent"] = {
        "kind": kind,
        "reason": _short(str(intent.get("reason", "")), "intent.reason"),
    }

    understanding["goals"] = _string_list(payload.get("goals"), "goals", _MAX_GOALS)

    audience = str(payload.get("audience", "")).strip()
    if audience not in _AUDIENCES:
        raise UnderstandingError(
            f"understanding.audience must be one of {_AUDIENCES}"
        )
    understanding["audience"] = audience

    understanding["platform_hints"] = _string_list(
        payload.get("platform_hints"), "platform_hints", _MAX_HINTS
    )
    understanding["constraints"] = _string_list(
        payload.get("constraints"), "constraints", _MAX_CONSTRAINTS
    )
    understanding["deliverables"] = _string_list(
        payload.get("deliverables"), "deliverables", _MAX_DELIVERABLES
    )

    decomposition = payload.get("decomposition")
    if not isinstance(decomposition, list):
        raise UnderstandingError("understanding.decomposition must be a list")
    if not (_MIN_STEPS <= len(decomposition) <= _MAX_STEPS):
        raise UnderstandingError(
            f"understanding.decomposition must have {_MIN_STEPS}..{_MAX_STEPS} steps"
        )
    steps = _string_list(decomposition, "decomposition", _MAX_STEPS)
    if len({s.lower() for s in steps}) != len(steps):
        raise UnderstandingError("understanding.decomposition has duplicate steps")
    understanding["decomposition"] = steps

    confidence = payload.get("confidence")
    if not isinstance(confidence, Mapping):
        raise UnderstandingError("understanding.confidence must be an object")
    level = str(confidence.get("level", "")).strip()
    if level not in _CONFIDENCE_LEVELS:
        raise UnderstandingError(
            f"understanding.confidence.level must be one of {_CONFIDENCE_LEVELS}"
        )
    understanding["confidence"] = {
        "level": level,
        "basis": _short(str(confidence.get("basis", "")), "confidence.basis"),
    }

    understanding["open_questions"] = _string_list(
        payload.get("open_questions"), "open_questions", _MAX_OPEN_QUESTIONS
    )
    return understanding


def _extract_goals(text: str) -> list[str]:
    return _bounded_clauses(
        [c for c in _clauses(text) if _GOAL_SIGNAL.search(c)], _MAX_GOALS
    )


def _extract_audience(text: str) -> str:
    for audience, patterns in _AUDIENCE_PATTERNS:
        if any(re.search(p, text, re.IGNORECASE) for p in patterns):
            return audience
    return "unknown"


def _platform_hints(text: str, repo_map: Mapping[str, Any]) -> list[str]:
    hints: list[str] = []
    seen: set[str] = set()
    types = repo_map.get("project_types") if isinstance(repo_map, Mapping) else None
    if isinstance(types, list):
        for t in types:
            t = str(t).strip().lower()
            if t and t != "unknown" and t not in seen:
                seen.add(t)
                hints.append(t)
    for name, pattern in _PLATFORM_TEXT_PATTERNS:
        if name not in seen and re.search(pattern, text, re.IGNORECASE):
            seen.add(name)
            hints.append(name)
    return hints[:_MAX_HINTS]


def _extract_constraints(text: str) -> list[str]:
    candidates = [
        c for c in _clauses(text)
        if any(p.search(c) for p in _CONSTRAINT_PATTERNS)
    ]
    return _bounded_clauses(candidates, _MAX_CONSTRAINTS)


def _extract_deliverables(text: str) -> list[str]:
    return _bounded_clauses(
        [c for c in _clauses(text) if _DELIVERABLE_SIGNAL.search(c)],
        _MAX_DELIVERABLES,
    )


def _decompose(intent_kind: str, goals: list[str], deliverables: list[str]) -> list[str]:
    """Deterministic 2..5 step decomposition from intent + goals only."""
    steps: list[str] = [f"Confirm the classified intent ({intent_kind}) with the instruction"]
    for goal in goals[:3]:
        steps.append(f"Work goal: {goal}")
    if deliverables:
        steps.append(f"Produce deliverable: {deliverables[0]}")
    steps.append("Verify the outcome against the named goals")
    # De-duplicate while preserving order, then bound to 2..5 steps. Step
    # text includes a goal/deliverable prefix — re-apply the word cap on the
    # composed step so the result passes its own validation.
    unique: list[str] = []
    for s in steps:
        s = " ".join(s.split()[:_MAX_FIELD_WORDS])
        if s.lower() not in {u.lower() for u in unique}:
            unique.append(s)
    if len(unique) < _MIN_STEPS:
        unique.append("Re-run understanding once the instruction is more specific")
    return unique[:_MAX_STEPS]


def _confidence(intent_kind: str, goals: list[str], deliverables: list[str],
                basis: str) -> dict[str, str]:
    if intent_kind == DEVELOPMENT_TASK and goals and deliverables:
        level = "high"
    elif goals or deliverables or intent_kind == ANALYSIS:
        level = "medium"
    else:
        level = "low"
    return {"level": level, "basis": basis}


def _basis(text: str, goals: list[str], constraints: list[str],
           platform_hints: list[str], intent_kind: str) -> str:
    """Confidence basis must quote the instruction or name a repo fact.

    When nothing is quotable the basis stays non-empty but honestly names
    the classification itself — the grounding GATE (not the parser) then
    refuses to treat it as grounded."""
    for quote in goals + constraints:
        words = quote.split()
        snippet = " ".join(words[:12])
        return f'instruction states: "{snippet}"'
    if platform_hints:
        return f"repo_map project_types includes: {', '.join(platform_hints[:3])}"
    return f"no quotable goal, constraint, or repo fact; intent classified as {intent_kind}"


def understand_project(text: str, repo_map: Mapping[str, Any] | None = None) -> dict[str, Any]:
    """Build a bounded, validated understanding of a raw instruction.

    Deterministic and offline: intent is reused from intent_gate, platform
    hints extend repository_mapper output, everything else is extracted by
    bounded keyword/structure rules. The result is validated through
    parse_understanding before return, so a caller always receives a
    well-formed object or an UnderstandingError — never a half-built one.
    """
    text = (text or "").strip()
    repo_map = repo_map if isinstance(repo_map, Mapping) else {}
    intent = classify_intent(text)

    goals = _extract_goals(text)
    constraints = _extract_constraints(text)
    deliverables = _extract_deliverables(text)
    hints = _platform_hints(text, repo_map)
    audience = _extract_audience(text)
    steps = _decompose(intent.kind, goals, deliverables)
    basis = _basis(text, goals, constraints, hints, intent.kind)

    open_questions: list[str] = []
    if not goals:
        open_questions.append("goals UNKNOWN — no explicit goal statements found")
    if not constraints:
        open_questions.append("constraints UNKNOWN — no deadline/budget/scope stated")
    if not deliverables:
        open_questions.append("deliverables UNKNOWN — no explicit deliverable stated")
    if audience == "unknown":
        open_questions.append("audience UNKNOWN — no audience wording found")
    if not hints:
        open_questions.append("platform UNKNOWN — no repo type or platform wording found")
    open_questions = open_questions[:_MAX_OPEN_QUESTIONS]

    return parse_understanding({
        "intent": {"kind": intent.kind, "reason": intent.reason},
        "goals": goals,
        "audience": audience,
        "platform_hints": hints,
        "constraints": constraints,
        "deliverables": deliverables,
        "decomposition": steps,
        "confidence": _confidence(intent.kind, goals, deliverables, basis),
        "open_questions": open_questions,
    })


# ---------------------------------------------------------------------------
# Deterministic consistency gates over the understanding + the instruction
# it claims to describe. Failures are reasons (empty = pass); nothing here
# weakens or replaces canonical validation.

def run_understanding_gates(
    understanding: Mapping[str, Any],
    instruction: str,
) -> list[str]:
    """Consistency gates: deliverables relate to named goals; decomposition
    steps are non-empty, ordered, and duplicate-free; confidence basis is
    grounded in the instruction or a repository fact."""
    failures: list[str] = []
    goals = understanding.get("goals", [])
    deliverables = understanding.get("deliverables", [])
    instruction = instruction or ""

    goal_tokens = set()
    for goal in goals:
        goal_tokens |= _tokens(goal)

    for deliverable in deliverables:
        del_tokens = _tokens(deliverable)
        if not goals:
            failures.append(
                f"deliverable '{deliverable[:50]}' has no named goal to relate to"
            )
            continue
        related = bool(goal_tokens & del_tokens) or any(
            len(t) >= 4 and (t in goal.lower() or goal.lower() in t)
            for t in del_tokens
            for goal in goals
        )
        if not related:
            failures.append(
                f"deliverable '{deliverable[:50]}' does not relate to any named goal"
            )

    steps = understanding.get("decomposition", [])
    normalized = [re.sub(r"\s+", " ", s).strip().lower() for s in steps]
    if any(not s for s in normalized):
        failures.append("decomposition contains an empty step")
    if len(set(normalized)) != len(normalized):
        failures.append("decomposition contains duplicate steps")
    if not (_MIN_STEPS <= len(steps) <= _MAX_STEPS):
        failures.append(
            f"decomposition must have {_MIN_STEPS}..{_MAX_STEPS} ordered steps"
        )

    basis = str(understanding.get("confidence", {}).get("basis", "")).lower()
    lowered_instruction = instruction.lower()
    grounded = any(
        token in basis
        for token in lowered_instruction.split()
        if len(token) >= 6
    )
    if not grounded:
        repo_facts = [str(h).lower() for h in understanding.get("platform_hints", [])]
        repo_facts += [p.lower() for p in extract_file_paths(instruction)]
        grounded = any(fact and fact in basis for fact in repo_facts)
    if not grounded:
        failures.append(
            "confidence basis is not grounded in the instruction or repository"
        )

    return failures


def understanding_readiness(
    understanding: Mapping[str, Any],
    gate_failures: list[str],
) -> dict[str, Any]:
    """Understanding readiness seal. READY requires clean gates and at
    least one named goal; missing goals block because an understanding
    without a goal is an understanding of nothing."""
    blocking = list(gate_failures)
    if not understanding.get("goals"):
        blocking.append("no named goals — understanding insufficient")
    ready = not blocking
    return {
        "ready": ready,
        "blocking_items": blocking,
        "seal": {
            "goals_named": bool(understanding.get("goals")),
            "gates_clean": not gate_failures,
            "basis_grounded": bool(understanding.get("confidence", {}).get("basis")),
            "audience_known": understanding.get("audience") != "unknown",
            "uncertainties_disclosed": bool(understanding.get("open_questions")),
            "authority_preserved": True,  # advisory engine only
        },
    }
