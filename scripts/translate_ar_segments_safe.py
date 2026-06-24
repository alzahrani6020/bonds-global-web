#!/usr/bin/env python3
"""
Translate Arabic text segments inside an HTML/JS file to English using Google Translate,
one segment at a time with a local cache file for reproducibility.
Usage: python scripts/translate_ar_segments_safe.py <file.html> [--dry-run]
"""
import re
import sys
import os
import urllib.parse
import urllib.request
import json
import time

ARABIC_RE = re.compile(
    r"[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]"
    r"[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF\s\d\u060C\u061B\u061F\u064B-\u065F\u0670]*"
)
MIN_LENGTH = 2
SLEEP = 0.15
CACHE_PATH = os.path.join(os.path.dirname(__file__), ".translate_cache.json")


def load_cache():
    if os.path.exists(CACHE_PATH):
        try:
            with open(CACHE_PATH, "r", encoding="utf-8") as f:
                return json.load(f)
        except Exception:
            pass
    return {}


def save_cache(cache):
    with open(CACHE_PATH, "w", encoding="utf-8") as f:
        json.dump(cache, f, ensure_ascii=False, indent=2)


def normalize_quotes(text):
    # Replace straight quotes with typographic ones to avoid breaking code/attributes.
    return text.replace("'", "\u2019").replace('"', "\u201D")


def translate_single(text, cache):
    if text in cache:
        return cache[text]
    url = (
        "https://translate.googleapis.com/translate_a/single?"
        "client=gtx&sl=ar&tl=en&dt=t&q=" + urllib.parse.quote(text)
    )
    try:
        with urllib.request.urlopen(url, timeout=30) as resp:
            data = json.loads(resp.read().decode("utf-8"))
        translated = "".join(item[0] for item in data[0])
    except Exception as e:
        print(f"Translation failed for {text!r}: {e}", file=sys.stderr)
        translated = text
    translated = normalize_quotes(translated)
    cache[text] = translated
    return translated


def main():
    if len(sys.argv) < 2:
        print(__doc__)
        sys.exit(1)
    path = sys.argv[1]
    dry_run = "--dry-run" in sys.argv

    with open(path, "r", encoding="utf-8") as f:
        content = f.read()

    segments = ARABIC_RE.findall(content)
    unique_segments = sorted(
        {s for s in segments if len(s) >= MIN_LENGTH and re.search(r"[\u0600-\u06FF]", s)}
    )

    if not unique_segments:
        print(f"No Arabic segments found in {path}")
        return

    print(f"Found {len(segments)} Arabic segments ({len(unique_segments)} unique) in {path}")

    cache = load_cache()
    mapping = {}
    for seg in unique_segments:
        mapping[seg] = translate_single(seg, cache)
        time.sleep(SLEEP)
    save_cache(cache)

    if dry_run:
        print("--- Sample mappings ---")
        for seg in list(unique_segments)[:30]:
            print(f"{seg!r} -> {mapping[seg]!r}")
        return

    def replacer(match):
        seg = match.group(0)
        if len(seg) < MIN_LENGTH:
            return seg
        if seg not in mapping or not mapping[seg]:
            return seg
        return mapping[seg]

    new_content = ARABIC_RE.sub(replacer, content)

    remaining = [s for s in ARABIC_RE.findall(new_content) if len(s) >= MIN_LENGTH]

    with open(path, "w", encoding="utf-8") as f:
        f.write(new_content)

    print(f"Updated {path}")
    print(f"Remaining Arabic segments (>= {MIN_LENGTH}): {len(remaining)}")
    if remaining:
        for seg in remaining[:30]:
            print(f"  - {seg!r}")


if __name__ == "__main__":
    main()
