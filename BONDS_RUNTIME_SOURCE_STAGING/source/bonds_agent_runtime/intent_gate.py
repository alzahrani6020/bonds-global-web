# Imported source snapshot for BONDS adaptation.
# Source: alzahrani6020/AFAQ-GIE@b1fec7fa400c57f32c2022a21cf74039379fc3cf:afaq_agent_runtime/intent_gate.py
# STAGING ONLY: not imported by BONDS runtime.

"""Deterministic intent gate for the Developer Agent.

Classifies a raw user instruction BEFORE it can enter the development
pipeline (Inspect → Propose → Approval → Edit/Test → Evaluate → Learn).
Greetings, thanks, and general chat must never spin up the coding model,
write tools, proposals, or approvals; ambiguous input must default to
asking for clarification instead of assuming a code change.

The gate is fully deterministic — no model calls — and layered rather
than keyword-only:

1. Development signals (file paths, code tokens, action verbs) are
   unambiguous: any single hit classifies as a development task.
2. Conversation patterns match only when the WHOLE message is a known
   social utterance (greeting / thanks / smalltalk / agent-status
   question) and no development term is present.
3. Anything else is clarification_required — the safe default.

Provenance: the "مرحبا" incident (task DEV-debced27) entered proposing
and stalled the proposal worker on a greeting.
"""

from __future__ import annotations

import re
from dataclasses import dataclass

DEVELOPMENT_TASK = "development_task"
CONVERSATION = "conversation"
CLARIFICATION_REQUIRED = "clarification_required"
# Self-directed inspection ("افحص نفسك"): answered from the live health
# snapshot by the developer agent — no model, no proposal, no writes.
SELF_STATUS = "self_status"
# Read-only analysis ("اشرح كيف يعمل add في calc.py"): the referenced
# file(s) are read through the project boundary and answered by a single
# model call — never a proposal, approval, or write.
ANALYSIS = "analysis"

# -- development signals -------------------------------------------------

# A path-like token ending in a known source/asset extension is the
# strongest possible development signal.
_FILE_PATH = re.compile(
    r"[A-Za-z0-9_./\\-]+\."
    r"(?:py|pyw|js|jsx|mjs|cjs|ts|tsx|css|scss|sass|html|htm|json|jsonc|md|"
    r"txt|sql|prisma|yml|yaml|toml|ini|cfg|conf|xml|sh|bash|bat|ps1|csv|"
    r"env|example|lock|svg)(?![A-Za-z0-9])",
    re.IGNORECASE,
)

# Code tokens that only appear in program text or when quoting it.
_CODE_TOKEN = re.compile(
    r"(?:\bdef\s+\w|\bclass\s+\w|\bimport\s+\w|\bfrom\s+\S+\s+import\b|"
    r"\bfunction\s+\w|\bconsole\.log|\bprint\s*\(|\breturn\b|"
    r"\bSELECT\b.{0,40}\bFROM\b|\basync\s+def\b|\bawait\s+\w|"
    r"\bconst\s+\w|\blet\s+\w|\bvar\s+\w|=>)",
    re.IGNORECASE,
)

# Analytic question patterns: the user wants to UNDERSTAND existing code, not
# change it. Only meaningful alongside a concrete file target; an explicit
# modification request (_is_modify_request) overrides it back to
# development_task.
_ANALYSIS_Q = re.compile(
    r"(?:اشرح|أشرح|اشرحي|"
    r"ما الذي|ماالتي|ما هي|ماهي|ما هو|ماهو|"
    r"كيف يعمل|كيف تعمل|كيف تشتغل|كيف يتم|"
    r"حلل|حللي|حليلي|"
    r"لماذا|ليش|"
    r"ما وظيفة|ماوظيفة|وظيفة|ماذا يفعل|ماذا تفعل|"
    r"اين تستخدم|اين يستخدم|أين تُستخدم|"
    r"\bexplain\b|\bwhat does\b|\bhow does\b|\bwhy does\b|"
    r"\banaly[sz]e\b|\bdescribe\b|\bwalk me through\b)",
    re.IGNORECASE,
)

# Explicit modification verbs: when one of these is present, an instruction
# is a change request even if it is phrased as a question ("كيف أصلح calc.py"
# wants an edit, not an explanation). Deliberately excludes inspection verbs
# (افحص/راجع/اختبر) — those keep their existing behavior elsewhere.
_MODIFY_VERB_AR = re.compile(
    r"(?:اصلح|أصلح|صحح|صحّح|"
    r"عدل|عدّل|اضف|أضف|"
    r"انشئ|أنشئ|اصنع|اكتب|"
    r"احذف|استبدل|اعد هيكلة|أعد هيكلة|ارفع|حدث|انقل)",
    re.IGNORECASE,
)
_MODIFY_VERB_EN = re.compile(
    r"(?:\bfix(?:es|ed|ing)?\b|\badd(?:s|ed|ing)?\b|\bimplement(?:s|ed|ing)?\b|"
    r"\bcreate[sd]?\b|\bwrite[sd]?\b|\bwrit(?:e|ing)\b|"
    r"\bmodif(?:y|ies|ied|ying)\b|\bupdate[sd]?\b|\bupdat(?:e|ing)\b|"
    r"\bremove[sd]?\b|\bdelete[sd]?\b|\bdelet(?:e|ing)\b|"
    r"\brefactor(?:ed|ing|s)?\b|\bpatch(?:es|ed|ing)?\b|\brepair(?:s|ed|ing)?\b|"
    r"\bimprove[sd]?\b|\boptimi[sz](?:e|es|ed|ing)\b)",
    re.IGNORECASE,
)

# A modify verb directly after one of these is typically a FUNCTION NAME in
# an analytic clause ("كيف يعمل add في calc.py"), not a verb — so it must not
# veto the analysis classification.
_QUESTION_WORD_BEFORE = re.compile(
    r"(?:كيف يعمل|كيف تعمل|كيف تشتغل|ما وظيفة|وظيفة|ماذا يفعل|ماذا تفعل|"
    r"اشرح|أشرح|اشرحي|حلل|حللي|لماذا|ليش|اين|أين|ما الذي|ماالتي|ما هي|ماهي|"
    r"دالة|الدالة|دوال|الدوال|function|method|class|"
    r"\bhow\b|\bwhat\b|\bwhy\b|\bwhere\b|\bwhen\b|"
    r"\bdoes\b|\bdid\b|\bis\b|\bare\b|\bwas\b|\bwere\b|"
    r"\bthe\b|\ban?\b|\bto\b|\bof\b|\bin\b)\W*$",
    re.IGNORECASE,
)


def _is_modify_request(text: str) -> bool:
    """True when the instruction explicitly asks to CHANGE code.

    Arabic modification imperatives are conclusive on their own. English
    modify verbs are conclusive unless they directly follow a question word —
    there they are usually identifiers ("كيف يعمل add"), not verbs.
    """
    if _MODIFY_VERB_AR.search(text):
        return True
    for match in _MODIFY_VERB_EN.finditer(text):
        prefix = text[max(0, match.start() - 60):match.start()]
        if _QUESTION_WORD_BEFORE.search(prefix):
            continue
        return True
    return False

# Self-referential target: the verb is aimed at the agent itself, not at the
# project ("افحص نفسك فقط", "اختبر نفسك"). Without a concrete project target
# (file path / code token — both checked above) this is a request for the
# agent's own live health, answered from the monitoring snapshot — never
# development work and never a model call.
_SELF_TARGET = re.compile(
    r"(?:نفسك|نفسِك|نفسه|نفسها|نفسهم|نفسكن|نفسي|"
    r"\byourself\b|\bitself\b)",
    re.IGNORECASE,
)

# Strong action verbs: an explicit imperative aimed at doing work. Arabic
# code-work imperatives and English action verbs are conclusive on their own
# ("أضف multiply(a, b) واختبرها" has no file path but is plainly a task).
_DEV_VERBS_STRONG = re.compile(
    r"(?:افحص|فحص|راجع|"
    r"اصلح|أصلح|صحح|صحّح|"
    r"عدل|عدّل|"
    r"اضف|أضف|"
    r"انشئ|أنشئ|اصنع|"
    r"اكتب|"
    r"اختبر|"
    r"ابحث|"
    r"احذف|استبدل|اعد هيكلة|أعد هيكلة|"
    r"\bfix(?:es|ed|ing)?\b|\badd(?:s|ed|ing)?\b|\bimplement(?:s|ed|ing)?\b|"
    r"\bcreate[sd]?\b|\bwrite[sd]?\b|\bwrit(?:e|ing)\b|"
    r"\bmodif(?:y|ies|ied|ying)\b|\bupdate[sd]?\b|\bupdat(?:e|ing)\b|"
    r"\bremove[sd]?\b|\bdelete[sd]?\b|\bdelet(?:e|ing)\b|"
    r"\brefactor(?:ed|ing|s)?\b|\bdebug(?:ged|ging)?\b|\bdebug\b|"
    r"\btest(?:s|ed|ing)?\b|\bexamines?\b|\bexamining\b|\binspect(?:s|ed|ing)?\b|"
    r"\banaly[sz](?:e|es|ed|ing|is)\b|\bchange[sd]?\b|\bchang(?:e|ing)\b|"
    r"\bpatch(?:es|ed|ing)?\b|\brepair(?:s|ed|ing)?\b|\binvestigat(?:e|es|ed|ing)\b|"
    r"\bimprove[sd]?\b|\boptimi[sz](?:e|es|ed|ing)\b|\bbuild[st]?\b|"
    r"\bmigrat(?:e|es|ed|ing)\b|\bupgrade[sd]?\b|\brebuild\b)",
    re.IGNORECASE,
)

# Weak signals: Arabic verb/noun forms that also appear in vague wishes
# ("نفذ اللازم", "أريد تحسينًا"). They only count WITH supporting evidence
# (a development term, a file path, or a code token) — never alone.
_DEV_WEAK = re.compile(
    r"(?:نفذ|نفّذ|تنفيذ|"
    r"طور|طوّر|تطوير|"
    r"حسن|حسّن|تحسين|"
    r"اصلاح|إصلاح|تصليح|تصحيح|تعديل|اضافة|إضافة|"
    r"انشاء|إنشاء|كتابة|مراجعة|اختبار|حذف|استبدال|هيكلة|نقل|تحديث|"
    r"انقل|ارفع|حدث)",
    re.IGNORECASE,
)

# Bare development terms. A verb above is sufficient on its own; these
# need code context (a path/code token) to be conclusive.
_DEV_TERMS = re.compile(
    r"(?:bug|bugs|خطأ|اخطاء|أخطاء|علة|علل|مشكلة|مشاكل|"
    r"test|tests|testing|unittest|pytest|اختبار|اختبارات|فشل|فاشل|فاشلة|"
    r"feature|features|ميزة|ميزات|خاصية|"
    r"function|دالة|دوال|method|method|كلاس|"
    r"كود|برمجة|برمجي|سكربت|script|"
    r"endpoint|api|route|component|صفحة|widget|"
    r"database|قاعدة بيانات|query|استعلام|migration|"
    r"error|exception|traceback|stack\s*trace|stacktrace)",
    re.IGNORECASE,
)

# -- conversation signals ------------------------------------------------

_GREETINGS = (
    "مرحبا", "مرحبتين", "هلا", "هلا والله", "هلاا",
    "اهلا", "اهلا وسهلا", "اهلين", "اهلا بك", "اهلا فيك",
    "السلام عليكم", "وعليكم السلام", "وعليكم السلام ورحمة الله",
    "صباح الخير", "صباح النور", "مساء الخير", "مساء النور",
    "تحية", "تحياتي", "هاي", "هلو",
    "hello", "hi", "hey", "yo", "hiya", "howdy",
    "good morning", "good evening", "good afternoon", "greetings",
)

_THANKS = (
    "شكرا", "شكرا جزيلا", "شكرًا", "شكراً", "مشكور", "مشكورة", "مشكورين",
    "تسلم", "تسلمين", "تسلمو", "يعطيك العافية", "يعطيكم العافية",
    "ما قصرت", "ما قصرتو", "احسنت", "أحسنت", "احسنتم",
    "thanks", "thank you", "thank you very much", "thx", "ty",
)

_SMALLTALK = (
    "كيف حالك", "كيفك", "كيف الحال", "كيفك اليوم", "كيف يومك",
    "اخبارك", "أخبارك", "اخباركم", "شخبارك", "شلونك", "شلونكم",
    "كيف الاحوال", "كيف الأحوال", "عامل ايه", "ازيك",
    "هل انت هنا", "هل انت موجود", "هل انت حاضر",
    "how are you", "how are you doing", "hows it going", "how is it going",
    "whats up", "what's up", "how do you do", "how was your day",
    "are you there", "you there", "anyone there", "anybody there",
)

# Whole-message questions about the agent/AIC state, not about the project.
_STATUS_Q = re.compile(
    r"^(?:هل\s+)?(?:"
    r"تعمل|تشتغل|يعمل|يشتغل|موجود|موجودة|حاضر|هنا|متصل|متصلة|"
    r"جاهز|جاهزة|متاح|متاحة|شغال|شغالة"
    r")[\w\s\u0600-\u06FF?!.]*$"
    r"|^هل\s+الـ?\s*(?:agent|aic|وكيل|نظام|النظام|runtime|الرون تايم|السيرفر)"
    r"[\w\s\u0600-\u06FF?!.]*\??$"
    r"|^ما\s+حالة\s+(?:الـ)?(?:aic|agent|الوكيل|النظام|السيستم|الرون\s*تايم|السيرفر)\s*\??$"
    r"|^(?:what|how|is|are)\b.{0,60}\b(agent|aic|runtime|system status)\b.{0,20}\?$"
    r"|^ agent\s+status\??$",
    re.IGNORECASE,
)

_MAX_CONVERSATION_CHARS = 120


def _normalize(text: str) -> str:
    t = re.sub(r"[\u064B-\u0652\u0670]", "", text)  # Arabic diacritics
    t = t.replace("أ", "ا").replace("إ", "ا").replace("آ", "ا")
    t = t.replace("؟", "?")  # Arabic question mark -> ASCII for matching
    t = re.sub(r"[^\w\s\u0600-\u06FF?.!]", " ", t, flags=re.UNICODE)
    t = re.sub(r"\s+", " ", t).strip().lower()
    return t


@dataclass(frozen=True)
class Intent:
    kind: str
    reason: str
    response: str | None = None


_GREETING_RESPONSE = (
    "مرحبًا! أنا Developer Agent — أتعامل مع مهام التطوير فقط: فحص الكود، "
    "الإصلاح، إضافة ميزات، وتشغيل الاختبارات. اكتب لي مهمة برمجية وسأقترح "
    "التغييرات لمراجعتك قبل أي تعديل."
)
_THANKS_RESPONSE = (
    "العفو! أنا هنا عندما تحتاج مهمة تطوير — فحص، إصلاح، أو تعديل. "
    "أرسل المهمة متى شئت."
)
_SMALLTALK_RESPONSE = (
    "بخير، شكرًا! جاهز لمهام التطوير — فحص، إصلاح، إضافة ميزات، أو اختبارات. "
    "ما المهمة التي تريد تنفيذها؟"
)
_STATUS_RESPONSE = (
    "أنا متصل ويعمل لديّ آخر إصدار من Runtime. أرسل مهمة تطوير وسأبدأ "
    "بفحص المشروع فورًا."
)
_CLARIFICATION_RESPONSE = (
    "لم تصلني مهمة واضحة. صف ما تريده بدقة — مثل: «افحص calc.py وابحث عن "
    "الخطأ» أو «أصلح الاختبار الفاشل في الملف الفلاني» — وسأقترح خطة "
    "التعديل عليك للموافقة قبل أي تغيير."
)


def classify_intent(instruction: str) -> Intent:
    """Classify a raw instruction deterministically (no model calls).

    development_task  → enter the normal pipeline unchanged.
    conversation      → reply socially; no model, tools, proposal, approval.
    clarification_required → ask for specifics; never assume a code change.
    """
    text = (instruction or "").strip()
    if not text:
        return Intent(CLARIFICATION_REQUIRED, "empty instruction",
                      _CLARIFICATION_RESPONSE)

    # 1) Development signals are conclusive on their own.
    if _FILE_PATH.search(text):
        # An analytic question about a concrete file ("اشرح كيف يعمل add في
        # calc.py") is read-only understanding work: the AI answers from the
        # file contents — no proposal, approval, or write. Any explicit
        # modification verb, or a self-directed target, keeps the existing
        # classification.
        if (_ANALYSIS_Q.search(text) and not _is_modify_request(text)
                and not _SELF_TARGET.search(text)):
            return Intent(ANALYSIS, "analytic question about a project file")
        return Intent(DEVELOPMENT_TASK, "references a file path")
    if _CODE_TOKEN.search(text):
        return Intent(DEVELOPMENT_TASK, "contains code tokens")
    if _SELF_TARGET.search(text):
        # Verb aimed at the agent itself with no concrete project target
        # (paths/tokens already ruled out above): answer from the live
        # health snapshot instead of guessing project work.
        return Intent(SELF_STATUS,
                      "inspection aimed at the agent itself",
                      "سأفحص حالتي الحية الآن (Runtime / Ollama / التخزين).")
    if _DEV_VERBS_STRONG.search(text):
        return Intent(DEVELOPMENT_TASK, "contains a development action verb")
    if _DEV_WEAK.search(text) and _DEV_TERMS.search(text):
        return Intent(DEVELOPMENT_TASK,
                      "vague work wording backed by a concrete development term")
    if _DEV_TERMS.search(text) and re.search(
        r"(?:في|in|داخل|inside|على|on)\s+[\w./\\-]+", text, re.IGNORECASE
    ):
        return Intent(DEVELOPMENT_TASK,
                      "development term tied to a concrete target")

    # 2) Conversation: the WHOLE message must be a known social utterance,
    #    short, and free of any development term.
    norm = _normalize(text)
    core = norm.rstrip("?!.؟").strip()
    dev_term_free = not _DEV_TERMS.search(text)
    if dev_term_free and len(core) <= _MAX_CONVERSATION_CHARS:
        if core in _GREETINGS:
            return Intent(CONVERSATION, "greeting", _GREETING_RESPONSE)
        if core in _THANKS:
            return Intent(CONVERSATION, "thanks", _THANKS_RESPONSE)
        if core in _SMALLTALK:
            return Intent(CONVERSATION, "smalltalk", _SMALLTALK_RESPONSE)
        if _STATUS_Q.match(norm):
            return Intent(CONVERSATION, "agent-status question",
                          _STATUS_RESPONSE)

    # 3) Safe default: never guess a code change.
    return Intent(CLARIFICATION_REQUIRED,
                  "no development signal and no clear conversation pattern",
                  _CLARIFICATION_RESPONSE)


def extract_file_paths(text: str) -> list[str]:
    """Project-relative file paths mentioned in an instruction (deduped, in
    order of appearance). Used by the read-only analysis path to decide which
    file(s) to read through the project boundary."""
    out: list[str] = []
    seen: set[str] = set()
    for match in _FILE_PATH.finditer(text or ""):
        path = match.group(0).strip(".,;:!?، ")
        if path and path not in seen:
            seen.add(path)
            out.append(path)
    return out
