#!/usr/bin/env python3
"""Replace emoji icons in HTML files with inline SVG equivalents or flag spans."""

import re
import sys
from collections import Counter
from pathlib import Path

EXCLUDE_DIRS = {"node_modules", ".git", ".vercel", "bonds-v2", "__pycache__"}

# Emoji detection regex. Required ranges per spec, with optional U+FE0F variation
# selector and an extra block for the geometric symbol ▤ found on the site.
EMOJI_RE = re.compile(
    r"(?:["
    r"\U000024C2-\U0001F251"
    r"\U000025A0-\U000025FF"
    r"\U00002600-\U000026FF"
    r"\U00002700-\U000027BF"
    r"\U0001F300-\U0001F9FF"
    r"]\uFE0F?)+",
    re.UNICODE,
)

# Regional indicator pairs (country flag emojis), optional trailing VS16.
FLAG_RE = re.compile(r"[\U0001F1E6-\U0001F1FF]{2}\uFE0F?", re.UNICODE)

# Splitter: tags, script/style blocks (preserved), and everything else (text content).
SEGMENT_RE = re.compile(
    r"(<[^>]+>|<script[^>]*>.*?</script>|<style[^>]*>.*?</style>)",
    re.DOTALL | re.IGNORECASE,
)

GENERIC_SVG = (
    '<svg class="bonds-icon bonds-icon--emoji" viewBox="0 0 24 24" fill="none" '
    'stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" '
    'aria-hidden="true"><circle cx="12" cy="12" r="9"></circle>'
    '<circle cx="12" cy="12" r="4"></circle></svg>'
)


def svg_for(entry):
    name, modifier, paths = entry
    cls = f"bonds-icon bonds-icon--{name}"
    if modifier:
        cls += f" bonds-icon--{modifier}"
    return (
        f'<svg class="{cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" '
        f'stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'
        f"{paths}</svg>"
    )


# ---------------------------------------------------------------------------
# Emoji -> (icon-name, modifier-class, inner SVG markup)
# ---------------------------------------------------------------------------
SVG_MAP = {
    "✓": ("check", "", '<polyline points="20 6 9 17 4 12"></polyline>'),
    "✦": ("sparkle", "", '<polygon points="12 2 14.5 9.5 22 12 14.5 14.5 12 22 9.5 14.5 2 12 9.5 9.5 12 2"></polygon>'),
    "✨": ("sparkles", "", '<path d="M12 3L14.5 9.5 21 12 14.5 14.5 12 21 9.5 14.5 3 12 9.5 9.5 12 3z"></path><path d="M5 3l1 1"></path><path d="M19 3l-1 1"></path><path d="M5 21l1-1"></path><path d="M19 21l-1-1"></path>'),
    "✍": ("edit", "", '<path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>'),
    "✏": ("pencil", "", '<path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"></path>'),
    "⬅": ("arrow-left", "", '<line x1="19" y1="12" x2="5" y2="12"></line><polyline points="12 19 5 12 12 5"></polyline>'),
    "⭐": ("star", "", '<polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon>'),
    "ⓘ": ("info", "", '<circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line>'),
    "➕": ("plus", "", '<line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line>'),
    "▤": ("grid", "", '<rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><line x1="3" y1="9" x2="21" y2="9"></line><line x1="3" y1="15" x2="21" y2="15"></line>'),
    "📈": ("trend-up", "", '<polyline points="23 6 13.5 15.5 8.5 10.5 1 18"></polyline><polyline points="17 6 23 6 23 12"></polyline>'),
    "🏗": ("construction", "", '<path d="M2 22h20"></path><path d="M6 22V11l6-4 6 4v11"></path><path d="M10 22v-5h4v5"></path><path d="M12 2v5"></path>'),
    "📐": ("ruler", "", '<path d="M22 2L2 22h20V2z"></path><path d="M6 22l16-16"></path><path d="M10 22l12-12"></path><path d="M14 22l8-8"></path><path d="M18 22l4-4"></path>'),
    "🔗": ("link", "", '<path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"></path><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"></path>'),
    "📞": ("phone", "", '<path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"></path>'),
    "🏙": ("city", "", '<path d="M3 21h18"></path><path d="M5 21V7l6-3v17"></path><path d="M13 21V10l6 3v8"></path><path d="M8 10h2"></path><path d="M8 14h2"></path><path d="M15 13h2"></path><path d="M15 17h2"></path>'),
    "🗺": ("map", "", '<polygon points="1 6 9 2 15 6 23 2 23 18 15 22 9 18 1 22"></polygon><line x1="9" y1="2" x2="9" y2="18"></line><line x1="15" y1="6" x2="15" y2="22"></line>'),
    "👷": ("worker", "", '<path d="M12 22a7 7 0 0 0 7-7c0-2-1-3.9-3-5.5s-3.5-4-4-6.5c-.5 2.5-2 4.9-4 6.5C6 11.1 5 13 5 15a7 7 0 0 0 7 7z"></path><path d="M12 4a3 3 0 1 0 0-6 3 3 0 0 0 0 6z"></path>'),
    "🏛": ("landmark", "", '<path d="M3 21h18"></path><path d="M4 21V10l8-6 8 6v11"></path><path d="M9 21v-6h6v6"></path><path d="M12 2v4"></path>'),
    "💾": ("save", "", '<path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"></path><polyline points="17 21 17 13 7 13 7 21"></polyline><polyline points="7 3 7 8 15 8"></polyline>'),
    "🌿": ("leaf", "", '<path d="M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.48 19 2c1 2 2 4.18 2 8 0 5.5-4.78 10-10 10Z"></path><path d="M2 21c0-3 1.85-5.36 5.08-6C9.5 14.52 12 13 13 12"></path>'),
    "🚒": ("fire-truck", "", '<path d="M4 17h12a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2H4v10z"></path><path d="M18 17h2a2 2 0 0 0 2-2v-2h-4v4z"></path><circle cx="7" cy="19" r="2"></circle><circle cx="17" cy="19" r="2"></circle><path d="M6 13h6"></path><path d="M9 13V9"></path><path d="M12 11l3-3"></path>'),
    "🏦": ("bank", "", '<path d="M12 2L2 11h20L12 2z"></path><rect x="3" y="11" width="18" height="10" rx="2"></rect><line x1="12" y1="11" x2="12" y2="21"></line>'),
    "📄": ("file-text", "", '<path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><line x1="10" y1="9" x2="8" y2="9"></line>'),
    "🖨": ("printer", "", '<path d="M6 9V2h12v7"></path><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"></path><path d="M6 14h12v8H6z"></path>'),
    "📱": ("smartphone", "", '<rect x="5" y="2" width="14" height="20" rx="2" ry="2"></rect><line x1="12" y1="18" x2="12.01" y2="18"></line>'),
    "💳": ("credit-card", "", '<rect x="2" y="5" width="20" height="14" rx="2"></rect><line x1="2" y1="10" x2="22" y2="10"></line>'),
    "🔴": ("circle", "danger", '<circle cx="12" cy="12" r="10"></circle>'),
    "🟢": ("circle", "success", '<circle cx="12" cy="12" r="10"></circle>'),
    "🟡": ("circle", "warning", '<circle cx="12" cy="12" r="10"></circle>'),
    "🌐": ("globe", "", '<circle cx="12" cy="12" r="10"></circle><line x1="2" y1="12" x2="22" y2="12"></line><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"></path>'),
    "🌍": ("globe", "", '<circle cx="12" cy="12" r="10"></circle><line x1="2" y1="12" x2="22" y2="12"></line><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"></path>'),
    "🍽": ("utensils", "", '<path d="M3 2v20"></path><path d="M7 2v6a2 2 0 0 0 2 2h0a2 2 0 0 0 2-2V2"></path><path d="M17 2v4a2 2 0 0 0 2 2h0a2 2 0 0 0 2-2V2"></path><path d="M21 2v20"></path>'),
    "🔐": ("lock", "", '<rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path><circle cx="12" cy="16" r="1"></circle><path d="M12 16v3"></path>'),
    "🌊": ("waves", "", '<path d="M2 6c.6.5 1.2 1 2.5 1C7 7 7 5 9.5 5c2.6 0 2.4 2 5 2 2.5 0 2.5-2 5-2 1.3 0 1.9.5 2.5 1"></path><path d="M2 12c.6.5 1.2 1 2.5 1 2.5 0 2.5-2 5-2 2.6 0 2.4 2 5 2 2.5 0 2.5-2 5-2 1.3 0 1.9.5 2.5 1"></path><path d="M2 18c.6.5 1.2 1 2.5 1 2.5 0 2.5-2 5-2 2.6 0 2.4 2 5 2 2.5 0 2.5-2 5-2 1.3 0 1.9.5 2.5 1"></path>'),
    "📌": ("pin", "", '<path d="M12 22s-8-4.5-8-11.8A8 8 0 0 1 12 2a8 8 0 0 1 8 8.2c0 7.3-8 11.8-8 11.8z"></path><circle cx="12" cy="10" r="3"></circle>'),
    "🌙": ("moon", "", '<path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path>'),
    "📦": ("package", "", '<line x1="16.5" y1="9.4" x2="7.5" y2="4.21"></line><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path><polyline points="3.27 6.96 12 12.01 20.73 6.96"></polyline><line x1="12" y1="22.08" x2="12" y2="12"></line>'),
    "📝": ("edit", "", '<path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>'),
    "📥": ("inbox", "", '<polyline points="22 12 16 12 14 15 10 15 8 12 2 12"></polyline><path d="M5.45 5.11L2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z"></path>'),
    "🗑": ("trash", "", '<polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line>'),
    "🧪": ("flask", "", '<path d="M10 2h4"></path><path d="M12 2v8"></path><path d="M17 21H7a2 2 0 0 1-1.73-3l7-12a2 2 0 0 1 3.46 0l7 12A2 2 0 0 1 17 21z"></path>'),
    "📚": ("book", "", '<path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"></path><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"></path>'),
    "🔄": ("refresh", "", '<polyline points="23 4 23 10 17 10"></polyline><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"></path>'),
    "💵": ("banknote", "", '<rect x="2" y="6" width="20" height="12" rx="2"></rect><circle cx="12" cy="12" r="2"></circle><path d="M6 12h.01"></path><path d="M18 12h.01"></path>'),
    "📧": ("mail", "", '<path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"></path><polyline points="22,6 12,13 2,6"></polyline>'),
    "📨": ("mail", "", '<path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"></path><polyline points="22,6 12,13 2,6"></polyline>'),
    "👤": ("user", "", '<path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle>'),
    "💻": ("laptop", "", '<path d="M4 4h16c1.1 0 2 .9 2 2v10c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"></path><line x1="2" y1="20" x2="22" y2="20"></line>'),
    "⚖": ("scale", "", '<path d="M12 22v-8"></path><path d="M12 14l6-3v4a6 6 0 0 1-6 3 6 6 0 0 1-6-3v-4l6 3z"></path><path d="M12 14V7"></path><path d="M9 7h6"></path><circle cx="12" cy="4" r="2"></circle>'),
    "📅": ("calendar", "", '<rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line>'),
    "💧": ("droplet", "", '<path d="M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0z"></path>'),
    "🔧": ("tool", "", '<path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"></path>'),
    "🍔": ("burger", "", '<path d="M4 8h16a2 2 0 0 1 2 2v2H2v-2a2 2 0 0 1 2-2z"></path><path d="M2 14h20v2a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2v-2z"></path><line x1="6" y1="18" x2="6" y2="18"></line><line x1="10" y1="18" x2="10" y2="18"></line><line x1="14" y1="18" x2="14" y2="18"></line><line x1="18" y1="18" x2="18" y2="18"></line>'),
    "🧠": ("brain", "", '<circle cx="12" cy="12" r="9"></circle><path d="M8 12h8"></path><path d="M12 8v8"></path>'),
    "📁": ("folder", "", '<path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path>'),
    "🎲": ("dice", "", '<rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><circle cx="8.5" cy="8.5" r="1.5"></circle><circle cx="15.5" cy="15.5" r="1.5"></circle>'),
    "🏷": ("tag", "", '<path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"></path><line x1="7" y1="7" x2="7.01" y2="7"></line>'),
    "👥": ("users", "", '<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M23 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path>'),
    "⚙": ("settings", "", '<circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path>'),
    "🛡": ("shield", "", '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path>'),
    "🏠": ("home", "", '<path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path><polyline points="9 22 9 12 15 12 15 22"></polyline>'),
    "🤖": ("bot", "", '<rect x="3" y="11" width="18" height="10" rx="2"></rect><circle cx="12" cy="5" r="2"></circle><path d="M12 7v4"></path><line x1="8" y1="16" x2="8.01" y2="16"></line><line x1="16" y1="16" x2="16.01" y2="16"></line>'),
    "🎁": ("gift", "", '<polyline points="20 12 20 22 4 22 4 12"></polyline><path d="M2 7h20v5H2z"></path><path d="M12 22V7"></path><path d="M12 7H7.5a2.5 2.5 0 0 1 0-5C11 2 12 7 12 7z"></path><path d="M12 7h4.5a2.5 2.5 0 0 0 0-5C13 2 12 7 12 7z"></path>'),
    "☁": ("cloud", "", '<path d="M18 10h-1.26A8 8 0 1 0 9 20h9a5 5 0 0 0 0-10z"></path>'),
    "🚚": ("truck", "", '<rect x="1" y="3" width="15" height="13"></rect><polygon points="16 8 20 8 23 11 23 16 16 16 16 8"></polygon><circle cx="5.5" cy="18.5" r="2.5"></circle><circle cx="18.5" cy="18.5" r="2.5"></circle>'),
    "🚛": ("truck", "", '<rect x="1" y="3" width="15" height="13"></rect><polygon points="16 8 20 8 23 11 23 16 16 16 16 8"></polygon><circle cx="5.5" cy="18.5" r="2.5"></circle><circle cx="18.5" cy="18.5" r="2.5"></circle>'),
    "🏥": ("hospital", "", '<rect x="4" y="4" width="16" height="16" rx="2"></rect><path d="M12 8v8"></path><path d="M8 12h8"></path>'),
    "🏨": ("building", "", '<path d="M3 21h18"></path><path d="M5 21V10l6-4 6 4v11"></path><path d="M9 21v-6h6v6"></path><path d="M10 13h1"></path><path d="M10 15h1"></path><path d="M14 13h1"></path><path d="M14 15h1"></path>'),
    "⚓": ("anchor", "", '<circle cx="12" cy="5" r="3"></circle><line x1="12" y1="22" x2="12" y2="8"></line><path d="M5 12H2a10 10 0 0 0 20 0h-3"></path>'),
    "📢": ("megaphone", "", '<path d="M3 11l18-5v12L3 14v-3z"></path><path d="M11.6 16.8a3 3 0 1 1-5.8-1.6"></path>'),
    "📤": ("send", "", '<line x1="22" y1="2" x2="11" y2="13"></line><polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>'),
    "🎉": ("party-popper", "", '<path d="M12 2v4"></path><path d="M12 18v4"></path><path d="M4.93 4.93l2.83 2.83"></path><path d="M16.24 16.24l2.83 2.83"></path><path d="M2 12h4"></path><path d="M18 12h4"></path><path d="M4.93 19.07l2.83-2.83"></path><path d="M16.24 7.76l2.83-2.83"></path>'),
    "🚪": ("door", "", '<path d="M18 20V6a2 2 0 0 0-2-2H8a2 2 0 0 0-2 2v14"></path><path d="M2 20h20"></path><path d="M14 12v.01"></path>'),
    "🌟": ("star", "glow", '<polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon>'),
    "🛒": ("shopping-cart", "", '<circle cx="9" cy="21" r="1"></circle><circle cx="20" cy="21" r="1"></circle><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"></path>'),
    "🤝": ("handshake", "", '<path d="M20.42 4.58a5.4 5.4 0 0 0-7.65 0l-.77.78-.77-.78a5.4 5.4 0 0 0-7.65 7.65l.77.78 7.65 7.65 7.65-7.65.77-.78a5.4 5.4 0 0 0 0-7.65z"></path><path d="M16 8l-4 4-4-4"></path><path d="M4 14l4 4"></path><path d="M20 14l-4 4"></path>'),
    "🎓": ("graduation-cap", "", '<path d="M22 10l-10-6L2 10l10 6 10-6z"></path><path d="M6 12v5a6 6 0 0 0 12 0v-5"></path><path d="M12 22V16"></path>'),
    "🎨": ("palette", "", '<circle cx="12" cy="12" r="10"></circle><circle cx="9" cy="10" r="1"></circle><circle cx="15" cy="10" r="1"></circle><circle cx="12" cy="15" r="1"></circle>'),
    "🔑": ("key", "", '<path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3-1.5 1.5"></path>'),
    "📭": ("mailbox", "", '<path d="M22 17a2 2 0 0 1-2 2H6l-4-4V5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v12z"></path><path d="M16 13V5"></path><path d="M16 9h6"></path>'),
    "🧾": ("receipt", "", '<path d="M4 2v20l3-2 3 2 3-2 3 2 3-2V2"></path><line x1="8" y1="8" x2="16" y2="8"></line><line x1="8" y1="12" x2="16" y2="12"></line><line x1="8" y1="16" x2="12" y2="16"></line>'),
}


def _is_emoji(ch):
    cp = ord(ch)
    if cp == 0xFE0F:
        return False
    # Box drawing characters are matched by the broad U+24C2..U+1F251 range
    # but should not be treated as emoji icons.
    if 0x2500 <= cp <= 0x257F:
        return False
    if 0x24C2 <= cp <= 0x1F251:
        return True
    if 0x25A0 <= cp <= 0x25FF:
        return True
    if 0x2600 <= cp <= 0x26FF:
        return True
    if 0x2700 <= cp <= 0x27BF:
        return True
    if 0x1F300 <= cp <= 0x1F9FF:
        return True
    return False


def _replace_match(match):
    fragment = match.group(0)
    out = []
    i = 0
    n = len(fragment)
    while i < n:
        # Country flag regional indicator pair
        if (
            i + 1 < n
            and "\U0001F1E6" <= fragment[i] <= "\U0001F1FF"
            and "\U0001F1E6" <= fragment[i + 1] <= "\U0001F1FF"
        ):
            chars = (fragment[i], fragment[i + 1])
            code = "".join(chr(ord(c) - 0x1F1E6 + ord("A")) for c in chars)
            out.append(f'<span class="bonds-flag bonds-flag--{code}">{code}</span>')
            i += 2
            if i < n and fragment[i] == "\uFE0F":
                i += 1
            continue

        ch = fragment[i]
        if ch == "\uFE0F":
            i += 1
            continue
        if not _is_emoji(ch):
            out.append(ch)
            i += 1
            continue

        entry = SVG_MAP.get(ch)
        out.append(svg_for(entry) if entry else GENERIC_SVG)
        i += 1
    return "".join(out)


def replace_in_html(text):
    parts = SEGMENT_RE.split(text)
    for i, part in enumerate(parts):
        if part.startswith("<"):
            continue
        parts[i] = EMOJI_RE.sub(_replace_match, part)
    return "".join(parts)


def main():
    root = Path.cwd()
    html_files = []
    for path in root.rglob("*.html"):
        if any(part in EXCLUDE_DIRS for part in path.parts):
            continue
        html_files.append(path)

    processed = 0
    changed = 0
    remaining = Counter()

    for path in sorted(html_files):
        try:
            text = path.read_text(encoding="utf-8", errors="ignore")
        except Exception as exc:
            print(f"  warning: could not read {path}: {exc}", file=sys.stderr)
            continue

        new_text = replace_in_html(text)
        processed += 1

        if new_text != text:
            path.write_text(new_text, encoding="utf-8")
            changed += 1

        remaining.update(EMOJI_RE.findall(new_text))

    print(f"Files processed: {processed}")
    print(f"Files changed:   {changed}")
    print("Remaining emoji counts (top 40):")
    for emoji, count in remaining.most_common(40):
        print(f"  {emoji!r}: {count}")


if __name__ == "__main__":
    main()
