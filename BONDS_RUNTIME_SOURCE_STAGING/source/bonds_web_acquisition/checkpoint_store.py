# Imported source snapshot for BONDS adaptation.
# Source: alzahrani6020/AFAQ-GIE@b1fec7fa400c57f32c2022a21cf74039379fc3cf:web_acquisition/checkpoint_store.py
# STAGING ONLY: not imported by BONDS runtime.

"""Durable SQLite adapter for crawl checkpoints.

The checkpoint format stays provider/storage neutral; this adapter is one local
implementation and is not architectural truth.
"""

from __future__ import annotations

import sqlite3
from pathlib import Path

from .contracts import CrawlCheckpoint
from .crawler import checkpoint_from_json, checkpoint_to_json


class CrawlCheckpointStore:
    def __init__(self, path: str | Path) -> None:
        self.path = str(path)
        self._conn = sqlite3.connect(self.path)
        self._conn.execute(
            """
            CREATE TABLE IF NOT EXISTS crawl_checkpoints (
                crawl_id TEXT PRIMARY KEY,
                version INTEGER NOT NULL,
                checkpoint_json TEXT NOT NULL
            )
            """
        )
        self._conn.commit()

    def save(
        self,
        crawl_id: str,
        checkpoint: CrawlCheckpoint,
        *,
        expected_version: int | None = None,
    ) -> int:
        if not crawl_id.strip():
            raise ValueError("crawl_id required")
        current = self._conn.execute(
            "SELECT version FROM crawl_checkpoints WHERE crawl_id=?",
            (crawl_id,),
        ).fetchone()
        current_version = int(current[0]) if current else None
        if expected_version is not None and current_version != expected_version:
            raise RuntimeError("STALE_CHECKPOINT_WRITE")
        next_version = (current_version or 0) + 1
        raw = checkpoint_to_json(checkpoint)
        self._conn.execute(
            """
            INSERT INTO crawl_checkpoints(crawl_id, version, checkpoint_json)
            VALUES (?, ?, ?)
            ON CONFLICT(crawl_id) DO UPDATE SET
                version=excluded.version,
                checkpoint_json=excluded.checkpoint_json
            """,
            (crawl_id, next_version, raw),
        )
        self._conn.commit()
        return next_version

    def load(self, crawl_id: str) -> tuple[CrawlCheckpoint, int] | None:
        row = self._conn.execute(
            "SELECT checkpoint_json, version FROM crawl_checkpoints WHERE crawl_id=?",
            (crawl_id,),
        ).fetchone()
        if not row:
            return None
        return checkpoint_from_json(str(row[0])), int(row[1])

    def close(self) -> None:
        self._conn.close()

    def __enter__(self) -> "CrawlCheckpointStore":
        return self

    def __exit__(self, exc_type, exc, tb) -> None:  # noqa: ANN001
        self.close()
