#!/usr/bin/env python3
"""
Apply shared profile autofill button to investment-center calculators.

Usage:
  python scripts/apply-profile-autofill.py --dry-run
  python scripts/apply-profile-autofill.py

What it does:
  - Scans calculators/investment-center/*.html and en/calculators/investment-center/*.html
  - Skips index.html and files already having BondsProfileAutofill
  - Adds profile-autofill.js script
  - Adds "Fill from my profile" button inside the country selector panel
"""

import argparse
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent

AR_BUTTON = """        <button type="button" class="bonds-btn bonds-btn-secondary" onclick="BondsProfileAutofill.fillFromUserProfile()" style="margin-top: 0.75rem;">
          👤 ملء من ملفي الشخصي
        </button>"""

EN_BUTTON = """        <button type="button" class="bonds-btn bonds-btn-secondary" onclick="BondsProfileAutofill.fillFromUserProfile()" style="margin-top: 0.75rem;">
          👤 Fill from my profile
        </button>"""


def is_arabic_file(path: Path) -> bool:
    return "en/" not in str(path.as_posix()).lower()


def rel_to_investment_center(path: Path) -> str:
    if is_arabic_file(path):
        return "./"
    return "../../../calculators/investment-center/"


def has_autofill(text: str) -> bool:
    return "profile-autofill.js" in text or "BondsProfileAutofill" in text


def inject_script(text: str, rel: str) -> str:
    script_tag = f'  <script src="{rel}profile-autofill.js?v=1"></script>'
    if "profile-autofill.js" in text:
        return text
    # Insert before decision-intelligence.js or shared-export.js
    for anchor in [f'<script src="{rel}decision-intelligence.js', '<script src="../../calculators/shared-export.js">', '<script src="../../../calculators/shared-export.js">']:
        if anchor in text:
            return text.replace(anchor, script_tag + "\n" + anchor, 1)
    # Fallback: before </body>
    if "</body>" in text:
        return text.replace("</body>", script_tag + "\n</body>", 1)
    return text


def inject_button(text: str, is_ar: bool) -> str:
    if "BondsProfileAutofill.fillFromUserProfile()" in text:
        return text
    button = AR_BUTTON if is_ar else EN_BUTTON

    # Pattern: small tag after country select inside country-selector-panel
    marker = '        <small style="display:block;margin-top:0.5rem;color:var(--text-secondary);">ستتغير رموز العملة فقط؛ الأرقام تبقى كما أدخلتها.</small>'
    if marker in text:
        return text.replace(marker, marker + "\n" + button, 1)

    marker_en = '        <small style="display:block;margin-top:0.5rem;color:var(--text-secondary);">Only currency symbols will change; numbers remain as you entered them.</small>'
    if marker_en in text:
        return text.replace(marker_en, marker_en + "\n" + button, 1)

    # Generic fallback: after any small inside country-selector-panel (risky, do only once)
    pattern = r'(<div class="investment-panel country-selector-panel">.*?<select id="country"[^>]*>.*?</select>\s*<small[^>]*>.*?</small>)'
    import re
    match = re.search(pattern, text, re.DOTALL | re.IGNORECASE)
    if match:
        end = match.end(1)
        return text[:end] + "\n" + button + text[end:]

    return text


def process_file(path: Path, dry_run: bool) -> dict:
    raw = path.read_bytes()
    newline = "\r\n" if b"\r\n" in raw else ("\n" if b"\n" in raw else None)
    text = raw.decode("utf-8")
    if newline:
        text = text.replace(newline, "\n")

    is_ar = is_arabic_file(path)
    rel = rel_to_investment_center(path)

    result = {"path": path, "changed": False, "notes": []}

    if "investment-engine.js" not in text:
        result["notes"].append("skip: not using investment-engine.js")
        return result

    if has_autofill(text):
        result["notes"].append("skip: already has profile autofill")
        return result

    original = text
    text = inject_script(text, rel)
    text = inject_button(text, is_ar)

    if text == original:
        result["notes"].append("no changes applied")
        return result

    result["changed"] = True
    result["notes"].append("applied profile autofill")

    if not dry_run:
        path.write_text(text.replace("\n", newline) if newline else text, encoding="utf-8")

    return result


def main():
    parser = argparse.ArgumentParser(description="Apply shared profile autofill button to investment-center calculators.")
    parser.add_argument("--dry-run", action="store_true", help="Preview changes without writing files.")
    args = parser.parse_args()

    files = []
    for base in [ROOT / "calculators" / "investment-center", ROOT / "en" / "calculators" / "investment-center"]:
        if base.exists():
            files.extend(sorted(base.glob("*.html")))

    skipped = []
    changed = []
    for path in files:
        if path.name == "index.html":
            skipped.append((path, "index"))
            continue
        result = process_file(path, args.dry_run)
        if result["changed"]:
            changed.append(path)
            print(f"  {'[DRY-RUN] ' if args.dry_run else ''}updated: {path.relative_to(ROOT)}")
        else:
            reason = "; ".join(result["notes"])
            skipped.append((path, reason))

    print(f"\nSummary: {len(changed)} changed, {len(skipped)} skipped")


if __name__ == "__main__":
    main()
