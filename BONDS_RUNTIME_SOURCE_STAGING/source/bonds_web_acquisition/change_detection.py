# Imported source snapshot for BONDS adaptation.
# Source: alzahrani6020/AFAQ-GIE@b1fec7fa400c57f32c2022a21cf74039379fc3cf:web_acquisition/change_detection.py
# STAGING ONLY: not imported by BONDS runtime.

"""Versioned source snapshots and structural/semantic change classification."""

from __future__ import annotations

import hashlib
import json
import re
from dataclasses import dataclass
from typing import Any


def _normalize_text(value: str) -> str:
    return re.sub(r"\s+", " ", value).strip()


@dataclass(frozen=True)
class SourceSnapshot:
    source_id: str
    version: str
    content_hash: str
    normalized_text_hash: str
    observed_at: str
    metadata: dict[str, Any]

    @classmethod
    def build(
        cls,
        *,
        source_id: str,
        version: str,
        content: bytes,
        observed_at: str,
        metadata: dict[str, Any] | None = None,
    ) -> "SourceSnapshot":
        text = content.decode("utf-8", errors="replace")
        return cls(
            source_id=source_id,
            version=version,
            content_hash=hashlib.sha256(content).hexdigest(),
            normalized_text_hash=hashlib.sha256(_normalize_text(text).encode("utf-8")).hexdigest(),
            observed_at=observed_at,
            metadata=dict(metadata or {}),
        )


@dataclass(frozen=True)
class ChangeDecision:
    state: str
    content_changed: bool
    semantic_text_changed: bool
    metadata_changes: tuple[str, ...]
    previous_version: str
    current_version: str

    def as_dict(self) -> dict[str, Any]:
        return {
            "state": self.state,
            "content_changed": self.content_changed,
            "semantic_text_changed": self.semantic_text_changed,
            "metadata_changes": list(self.metadata_changes),
            "previous_version": self.previous_version,
            "current_version": self.current_version,
        }


def compare_snapshots(previous: SourceSnapshot, current: SourceSnapshot) -> ChangeDecision:
    if previous.source_id != current.source_id:
        raise ValueError("cross-source snapshot comparison forbidden")
    content_changed = previous.content_hash != current.content_hash
    semantic_changed = previous.normalized_text_hash != current.normalized_text_hash
    keys = set(previous.metadata) | set(current.metadata)
    metadata_changes = tuple(
        sorted(key for key in keys if previous.metadata.get(key) != current.metadata.get(key))
    )
    if not content_changed and not metadata_changes:
        state = "UNCHANGED"
    elif semantic_changed:
        state = "SEMANTIC_CHANGE"
    else:
        state = "STRUCTURAL_OR_METADATA_CHANGE"
    return ChangeDecision(
        state=state,
        content_changed=content_changed,
        semantic_text_changed=semantic_changed,
        metadata_changes=metadata_changes,
        previous_version=previous.version,
        current_version=current.version,
    )


def snapshot_json(snapshot: SourceSnapshot) -> str:
    return json.dumps(
        {
            "source_id": snapshot.source_id,
            "version": snapshot.version,
            "content_hash": snapshot.content_hash,
            "normalized_text_hash": snapshot.normalized_text_hash,
            "observed_at": snapshot.observed_at,
            "metadata": snapshot.metadata,
        },
        sort_keys=True,
        separators=(",", ":"),
    )
