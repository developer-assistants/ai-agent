"""SQLite-backed memory and run history store for AI agents."""

from __future__ import annotations

import json
import os
import sqlite3
from datetime import datetime, timezone
from pathlib import Path
from typing import Any


def default_db_path() -> Path:
    env_path = os.environ.get("AI_AGENT_DB")
    if env_path:
        return Path(env_path)
    return Path.home() / ".ai-agent" / "memory.db"


class AgentMemory:
    """Stores agent runs, step traces, and reusable key-value state."""

    def __init__(self, db_path: str | Path | None = None) -> None:
        self.db_path = Path(db_path) if db_path else default_db_path()
        self.db_path.parent.mkdir(parents=True, exist_ok=True)
        self._init_db()

    def _connect(self) -> sqlite3.Connection:
        conn = sqlite3.connect(str(self.db_path))
        conn.row_factory = sqlite3.Row
        return conn

    def _init_db(self) -> None:
        with self._connect() as conn:
            conn.execute(
                """
                CREATE TABLE IF NOT EXISTS runs (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    agent_id TEXT NOT NULL,
                    created_at TEXT NOT NULL,
                    status TEXT NOT NULL,
                    verified INTEGER NOT NULL,
                    input_summary TEXT NOT NULL,
                    summary TEXT NOT NULL,
                    payload_json TEXT NOT NULL
                )
                """
            )
            conn.execute(
                """
                CREATE TABLE IF NOT EXISTS kv_memory (
                    namespace TEXT NOT NULL,
                    key TEXT NOT NULL,
                    value_json TEXT NOT NULL,
                    updated_at TEXT NOT NULL,
                    PRIMARY KEY (namespace, key)
                )
                """
            )

    def save_run(
        self,
        agent_id: str,
        status: str,
        verified: bool,
        input_summary: str,
        summary: str,
        payload: dict[str, Any],
    ) -> int:
        now = datetime.now(timezone.utc).isoformat()
        with self._connect() as conn:
            cur = conn.execute(
                """
                INSERT INTO runs (
                    agent_id, created_at, status, verified,
                    input_summary, summary, payload_json
                )
                VALUES (?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    agent_id,
                    now,
                    status,
                    1 if verified else 0,
                    input_summary[:500],
                    summary[:1000],
                    json.dumps(payload, ensure_ascii=False),
                ),
            )
            return int(cur.lastrowid)

    def list_runs(self, limit: int = 20, agent_id: str | None = None) -> list[dict[str, Any]]:
        with self._connect() as conn:
            if agent_id:
                rows = conn.execute(
                    """
                    SELECT id, agent_id, created_at, status, verified, input_summary, summary
                    FROM runs
                    WHERE agent_id = ?
                    ORDER BY id DESC
                    LIMIT ?
                    """,
                    (agent_id, limit),
                ).fetchall()
            else:
                rows = conn.execute(
                    """
                    SELECT id, agent_id, created_at, status, verified, input_summary, summary
                    FROM runs
                    ORDER BY id DESC
                    LIMIT ?
                    """,
                    (limit,),
                ).fetchall()
        return [
            {
                "id": row["id"],
                "agent_id": row["agent_id"],
                "created_at": row["created_at"],
                "status": row["status"],
                "verified": bool(row["verified"]),
                "input_summary": row["input_summary"],
                "summary": row["summary"],
            }
            for row in rows
        ]

    def set_value(self, namespace: str, key: str, value: Any) -> None:
        now = datetime.now(timezone.utc).isoformat()
        with self._connect() as conn:
            conn.execute(
                """
                INSERT INTO kv_memory (namespace, key, value_json, updated_at)
                VALUES (?, ?, ?, ?)
                ON CONFLICT(namespace, key) DO UPDATE SET
                    value_json = excluded.value_json,
                    updated_at = excluded.updated_at
                """,
                (namespace, key, json.dumps(value, ensure_ascii=False), now),
            )

    def get_value(self, namespace: str, key: str, default: Any = None) -> Any:
        with self._connect() as conn:
            row = conn.execute(
                "SELECT value_json FROM kv_memory WHERE namespace = ? AND key = ?",
                (namespace, key),
            ).fetchone()
        if not row:
            return default
        return json.loads(row["value_json"])
