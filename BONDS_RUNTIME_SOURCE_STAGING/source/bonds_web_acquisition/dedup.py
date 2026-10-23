# Imported source snapshot for BONDS adaptation.
# Source: alzahrani6020/AFAQ-GIE@b1fec7fa400c57f32c2022a21cf74039379fc3cf:web_acquisition/dedup.py
# STAGING ONLY: not imported by BONDS runtime.

"""Bounded semantic near-duplicate detection for crawl observations."""

from __future__ import annotations

import hashlib
import re
from dataclasses import dataclass


def normalized_tokens(text: str) -> tuple[str, ...]:
    return tuple(re.findall(r"[a-z0-9_\-]{2,}", text.lower()))


def simhash64(text: str) -> int:
    tokens = normalized_tokens(text)
    if not tokens:
        return 0
    weights = [0] * 64
    for token in tokens:
        digest = hashlib.sha256(token.encode("utf-8")).digest()
        value = int.from_bytes(digest[:8], "big")
        for bit in range(64):
            weights[bit] += 1 if (value >> bit) & 1 else -1
    out = 0
    for bit, weight in enumerate(weights):
        if weight >= 0:
            out |= 1 << bit
    return out


def hamming_distance(left: int, right: int) -> int:
    return (left ^ right).bit_count()


@dataclass(frozen=True)
class NearDuplicate:
    duplicate: bool
    matched_url: str | None
    distance: int | None


def find_near_duplicate(
    text: str,
    known: dict[str, int],
    *,
    max_distance: int = 3,
) -> NearDuplicate:
    current = simhash64(text)
    best_url = None
    best_distance = None
    for url, fingerprint in known.items():
        distance = hamming_distance(current, fingerprint)
        if best_distance is None or distance < best_distance:
            best_url = url
            best_distance = distance
    return NearDuplicate(
        duplicate=best_distance is not None and best_distance <= max_distance,
        matched_url=best_url if best_distance is not None and best_distance <= max_distance else None,
        distance=best_distance,
    )
