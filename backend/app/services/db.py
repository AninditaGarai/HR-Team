from __future__ import annotations

import json
import sqlite3
from pathlib import Path
from typing import Any

DB_PATH = Path(__file__).resolve().parents[2] / "hr_data.db"


def get_conn():
    conn = sqlite3.connect(DB_PATH, check_same_thread=False)
    conn.row_factory = sqlite3.Row
    return conn


def init_db() -> None:
    DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    conn = get_conn()
    cur = conn.cursor()
    cur.execute(
        """
        CREATE TABLE IF NOT EXISTS sessions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            resume_text TEXT,
            category TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
        """
    )
    cur.execute(
        """
        CREATE TABLE IF NOT EXISTS interactions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            session_id INTEGER,
            question TEXT,
            answer TEXT,
            evaluation_json TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY(session_id) REFERENCES sessions(id)
        )
        """
    )
    conn.commit()
    conn.close()


def create_session(resume_text: str | None, category: str | None) -> int:
    conn = get_conn()
    cur = conn.cursor()
    cur.execute(
        "INSERT INTO sessions (resume_text, category) VALUES (?, ?)",
        (resume_text, category),
    )
    conn.commit()
    session_id = cur.lastrowid
    conn.close()
    return session_id


def add_interaction(session_id: int, question: str, answer: str | None, evaluation: Any | None) -> int:
    conn = get_conn()
    cur = conn.cursor()
    cur.execute(
        "INSERT INTO interactions (session_id, question, answer, evaluation_json) VALUES (?, ?, ?, ?)",
        (session_id, question, answer, json.dumps(evaluation) if evaluation is not None else None),
    )
    conn.commit()
    iid = cur.lastrowid
    conn.close()
    return iid


def get_session(session_id: int) -> dict:
    conn = get_conn()
    cur = conn.cursor()
    cur.execute("SELECT * FROM sessions WHERE id = ?", (session_id,))
    row = cur.fetchone()
    if not row:
        conn.close()
        raise KeyError("session not found")
    cur.execute("SELECT * FROM interactions WHERE session_id = ? ORDER BY created_at ASC", (session_id,))
    interactions = [dict(r) for r in cur.fetchall()]
    conn.close()
    # parse evaluation_json
    for inter in interactions:
        if inter.get("evaluation_json"):
            inter["evaluation"] = json.loads(inter["evaluation_json"])
            del inter["evaluation_json"]
    return {"session": dict(row), "interactions": interactions}


def delete_session(session_id: int) -> bool:
    conn = get_conn()
    cur = conn.cursor()
    cur.execute("DELETE FROM interactions WHERE session_id = ?", (session_id,))
    cur.execute("DELETE FROM sessions WHERE id = ?", (session_id,))
    deleted = cur.rowcount > 0
    conn.commit()
    conn.close()
    return deleted


def list_sessions(limit: int = 50, evaluated_only: bool = False) -> list[dict]:
    conn = get_conn()
    cur = conn.cursor()
    query = [
        "SELECT s.id, s.resume_text, s.category, s.created_at,",
        "EXISTS(",
        "    SELECT 1",
        "    FROM interactions i",
        "    WHERE i.session_id = s.id AND i.evaluation_json IS NOT NULL",
        ") AS has_evaluated_answer",
        "FROM sessions s",
    ]
    params: list[Any] = []
    if evaluated_only:
        query.append(
            "WHERE EXISTS(SELECT 1 FROM interactions i WHERE i.session_id = s.id AND i.evaluation_json IS NOT NULL)"
        )
    query.append("ORDER BY s.created_at DESC LIMIT ?")
    params.append(limit)
    cur.execute("\n".join(query), params)
    rows = [dict(r) for r in cur.fetchall()]
    conn.close()
    return rows


def export_sessions(limit: int = 200, evaluated_only: bool = False) -> list[dict]:
    sessions = list_sessions(limit=limit, evaluated_only=evaluated_only)
    exported: list[dict] = []
    for session in sessions:
        try:
            exported.append(get_session(int(session["id"])))
        except KeyError:
            continue
    return exported
