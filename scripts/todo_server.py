#!/usr/bin/env python3

from __future__ import annotations

import argparse
import csv
import functools
import json
import sqlite3
import time
import urllib.error
import urllib.request
from datetime import UTC, datetime, timedelta
from email.utils import formatdate
from http import HTTPStatus
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from typing import Any
from urllib.parse import parse_qs, urlparse

DEFAULT_TEAMS = [
    "BUH",
    "Process Improvement",
    "Sales",
    "OKR",
    "Product",
    "Projects",
]

SCHEMA = """
CREATE TABLE IF NOT EXISTS tasks (
    id INTEGER PRIMARY KEY,
    position INTEGER NOT NULL,
    name TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'Not started',
    team TEXT NOT NULL DEFAULT '',
    mode TEXT NOT NULL DEFAULT '',
    owner TEXT NOT NULL DEFAULT '',
    priority TEXT NOT NULL DEFAULT '',
    urgency TEXT NOT NULL DEFAULT '',
    importance TEXT NOT NULL DEFAULT '',
    time_estimate TEXT NOT NULL DEFAULT '',
    goal TEXT NOT NULL DEFAULT '',
    deadline TEXT NOT NULL DEFAULT '',
    scheduled_date TEXT NOT NULL DEFAULT '',
    scheduled_hour TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL DEFAULT '',
    completed_at TEXT NOT NULL DEFAULT '',
    notes TEXT NOT NULL DEFAULT ''
);

CREATE TABLE IF NOT EXISTS teams (
    name TEXT PRIMARY KEY,
    position INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS goals (
    name TEXT PRIMARY KEY,
    position INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL DEFAULT ''
);
"""


class TodoStore:
    def __init__(self, db_file: str):
        self.db_file = Path(db_file)
        self.db_file.parent.mkdir(parents=True, exist_ok=True)
        self._calendar_cache: dict[str, Any] = {
            "url": "",
            "fetched_at": 0.0,
            "raw": "",
        }
        self._init_db()

    def _connect(self) -> sqlite3.Connection:
        connection = sqlite3.connect(self.db_file)
        connection.row_factory = sqlite3.Row
        return connection

    def _init_db(self) -> None:
        with self._connect() as connection:
            connection.executescript(SCHEMA)
            task_columns = {
                row["name"]
                for row in connection.execute("PRAGMA table_info(tasks)").fetchall()
            }

            if "urgency" not in task_columns:
                connection.execute(
                    "ALTER TABLE tasks ADD COLUMN urgency TEXT NOT NULL DEFAULT ''"
                )
            if "mode" not in task_columns:
                connection.execute(
                    "ALTER TABLE tasks ADD COLUMN mode TEXT NOT NULL DEFAULT ''"
                )
            if "owner" not in task_columns:
                connection.execute(
                    "ALTER TABLE tasks ADD COLUMN owner TEXT NOT NULL DEFAULT ''"
                )
            if "priority" not in task_columns:
                connection.execute(
                    "ALTER TABLE tasks ADD COLUMN priority TEXT NOT NULL DEFAULT ''"
                )
            if "importance" not in task_columns:
                connection.execute(
                    "ALTER TABLE tasks ADD COLUMN importance TEXT NOT NULL DEFAULT ''"
                )
            if "time_estimate" not in task_columns:
                connection.execute(
                    "ALTER TABLE tasks ADD COLUMN time_estimate TEXT NOT NULL DEFAULT ''"
                )
            if "goal" not in task_columns:
                connection.execute(
                    "ALTER TABLE tasks ADD COLUMN goal TEXT NOT NULL DEFAULT ''"
                )
            if "scheduled_date" not in task_columns:
                connection.execute(
                    "ALTER TABLE tasks ADD COLUMN scheduled_date TEXT NOT NULL DEFAULT ''"
                )
            if "scheduled_hour" not in task_columns:
                connection.execute(
                    "ALTER TABLE tasks ADD COLUMN scheduled_hour TEXT NOT NULL DEFAULT ''"
                )
            if "created_at" not in task_columns:
                connection.execute(
                    "ALTER TABLE tasks ADD COLUMN created_at TEXT NOT NULL DEFAULT ''"
                )
            if "completed_at" not in task_columns:
                connection.execute(
                    "ALTER TABLE tasks ADD COLUMN completed_at TEXT NOT NULL DEFAULT ''"
                )

            if "prio" in task_columns:
                connection.execute(
                    """
                    UPDATE tasks
                    SET importance = CASE
                        WHEN importance != '' THEN importance
                        WHEN prio IN ('high', 'medium') THEN 'yes'
                        WHEN prio = 'low' THEN 'no'
                        ELSE ''
                    END
                    """
                )

            for row in connection.execute(
                "SELECT id, created_at FROM tasks WHERE created_at = '' OR created_at IS NULL"
            ).fetchall():
                connection.execute(
                    "UPDATE tasks SET created_at = ? WHERE id = ?",
                    (self._infer_created_at(row["id"]), row["id"]),
                )

            connection.execute(
                """
                UPDATE tasks
                SET priority = CASE
                    WHEN priority != '' THEN priority
                    WHEN importance = 'yes' AND urgency = 'yes' THEN 'Must'
                    WHEN importance = 'yes' OR urgency = 'yes' THEN 'Should'
                    ELSE priority
                END
                WHERE priority = ''
                """
            )

            connection.execute(
                """
                UPDATE tasks
                SET mode = CASE
                    WHEN status = 'Done' THEN mode
                    WHEN urgency = 'yes' THEN 'Run'
                    WHEN importance = 'yes' THEN 'Change'
                    WHEN team IN ('Product', 'OKR', 'Projects', 'Process Improvement') THEN 'Change'
                    WHEN team IN ('BUH', 'Sales') THEN 'Run'
                    ELSE mode
                END
                WHERE mode = ''
                """
            )

            connection.execute(
                """
                UPDATE tasks
                SET owner = 'Me'
                WHERE owner = '' AND status != 'Done'
                """
            )

            team_count = connection.execute("SELECT COUNT(*) FROM teams").fetchone()[0]
            if not team_count:
                team_names = self._derive_team_names(connection)
                connection.executemany(
                    "INSERT INTO teams (name, position) VALUES (?, ?)",
                    [(team, position) for position, team in enumerate(team_names)],
                )

            goal_count = connection.execute("SELECT COUNT(*) FROM goals").fetchone()[0]
            if not goal_count:
                goal_names = self._derive_goal_names(connection)
                connection.executemany(
                    "INSERT INTO goals (name, position) VALUES (?, ?)",
                    [(goal, position) for position, goal in enumerate(goal_names)],
                )

            connection.execute(
                """
                INSERT INTO settings (key, value)
                VALUES ('calendar_feed_url', '')
                ON CONFLICT(key) DO NOTHING
                """
            )
            connection.commit()

    def import_csv_once(self, csv_file: str | None) -> bool:
        if not csv_file:
            return False

        seed_path = Path(csv_file)
        if not seed_path.exists():
            return False

        with self._connect() as connection:
            count = connection.execute("SELECT COUNT(*) FROM tasks").fetchone()[0]
            if count:
                return False

        tasks = parse_csv_tasks(seed_path.read_text(encoding="utf-8-sig"))
        self.replace_tasks(tasks)
        seed_path.unlink()
        return True

    def fetch_teams(self) -> list[str]:
        with self._connect() as connection:
            rows = connection.execute(
                "SELECT name FROM teams ORDER BY position ASC, name ASC"
            ).fetchall()

        return [str(row["name"]) for row in rows]

    def fetch_goals(self) -> list[str]:
        with self._connect() as connection:
            rows = connection.execute(
                "SELECT name FROM goals ORDER BY position ASC, name ASC"
            ).fetchall()

        return [str(row["name"]) for row in rows]

    def fetch_settings(self) -> dict[str, str]:
        with self._connect() as connection:
            rows = connection.execute(
                "SELECT key, value FROM settings"
            ).fetchall()
        return {str(row["key"]): str(row["value"]) for row in rows}

    def update_calendar_feed_url(self, feed_url: str) -> None:
        normalized = str(feed_url or "").strip()
        with self._connect() as connection:
            connection.execute(
                """
                INSERT INTO settings (key, value)
                VALUES ('calendar_feed_url', ?)
                ON CONFLICT(key) DO UPDATE SET value = excluded.value
                """,
                (normalized,),
            )
            connection.commit()
        self._calendar_cache = {"url": "", "fetched_at": 0.0, "raw": ""}

    def fetch_calendar_events(self, start: str, days: int) -> list[dict[str, str]]:
        start_date = self._normalize_iso_date(start)
        if not start_date:
            raise ValueError("start must be YYYY-MM-DD")

        settings = self.fetch_settings()
        feed_url = str(settings.get("calendar_feed_url", "")).strip()
        if not feed_url:
            return []

        raw_calendar = self._load_calendar_feed(feed_url)
        return self._extract_calendar_events(raw_calendar, start_date, days)

    def fetch_tasks(self, *, completed_at: str | None = None) -> list[dict[str, Any]]:
        with self._connect() as connection:
            if completed_at:
                rows = connection.execute(
                    """
                    SELECT id, name, status, team, mode, owner, priority, time_estimate, goal, deadline, scheduled_date, scheduled_hour, created_at, completed_at, notes
                    FROM tasks
                    WHERE completed_at = ?
                    ORDER BY position ASC, id ASC
                    """,
                    (completed_at,),
                ).fetchall()
            else:
                rows = connection.execute(
                    """
                    SELECT id, name, status, team, mode, owner, priority, time_estimate, goal, deadline, scheduled_date, scheduled_hour, created_at, completed_at, notes
                    FROM tasks
                    ORDER BY position ASC, id ASC
                    """
                ).fetchall()

        return [dict(row) for row in rows]

    def fetch_task(self, task_id: int) -> dict[str, Any] | None:
        with self._connect() as connection:
            row = connection.execute(
                """
                SELECT id, name, status, team, mode, owner, priority, time_estimate, goal, deadline, scheduled_date, scheduled_hour, created_at, completed_at, notes
                FROM tasks
                WHERE id = ?
                """,
                (task_id,),
            ).fetchone()

        return dict(row) if row else None

    def replace_tasks(self, tasks: list[dict[str, Any]]) -> None:
        normalized = []
        used_ids: set[int] = set()
        next_generated_id = 1
        with self._connect() as connection:
            existing_completion = self._fetch_completion_context(connection)

        for position, task in enumerate(tasks):
            raw_id = task.get("id")
            task_id = raw_id if isinstance(raw_id, int) and raw_id > 0 else None
            while task_id is None or task_id in used_ids:
                while next_generated_id in used_ids:
                    next_generated_id += 1
                task_id = next_generated_id
                next_generated_id += 1

            used_ids.add(task_id)
            normalized.append(
                (
                    task_id,
                    position,
                    str(task.get("name", "")).strip(),
                    str(task.get("status", "Not started")).strip() or "Not started",
                    self._normalize_area(task.get("team", ""), task.get("area", "")),
                    self._normalize_mode(task.get("mode", "")),
                    self._normalize_owner(task.get("owner", "")),
                    self._normalize_priority(task.get("priority", "")),
                    self._normalize_time_estimate(task.get("time_estimate", "")),
                    str(task.get("goal", "")).strip(),
                    str(task.get("deadline", "")).strip(),
                    self._normalize_iso_date(task.get("scheduled_date", "")),
                    self._normalize_scheduled_hour(task.get("scheduled_hour", "")),
                    self._normalize_created_at(task.get("created_at", ""), task_id),
                    self._resolve_completed_at(
                        task.get("completed_at", ""),
                        str(task.get("status", "Not started")).strip() or "Not started",
                        *existing_completion.get(task_id, ("", "")),
                    ),
                    str(task.get("notes", "")).strip(),
                )
            )

        team_names = self._normalize_team_names(None, tasks)
        goal_names = self._normalize_goal_names(None, tasks)

        with self._connect() as connection:
            connection.execute("BEGIN")
            connection.execute("DELETE FROM tasks")
            connection.executemany(
                """
                INSERT INTO tasks (id, position, name, status, team, mode, owner, priority, time_estimate, goal, deadline, scheduled_date, scheduled_hour, created_at, completed_at, notes)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                [row for row in normalized if row[2]],
            )
            self._replace_teams(connection, team_names)
            self._replace_goals(connection, goal_names)
            connection.commit()

    def replace_state(
        self,
        tasks: list[dict[str, Any]],
        teams: list[str] | None = None,
        goals: list[str] | None = None,
    ) -> None:
        normalized = []
        used_ids: set[int] = set()
        next_generated_id = 1
        with self._connect() as connection:
            existing_completion = self._fetch_completion_context(connection)

        for position, task in enumerate(tasks):
            raw_id = task.get("id")
            task_id = raw_id if isinstance(raw_id, int) and raw_id > 0 else None
            while task_id is None or task_id in used_ids:
                while next_generated_id in used_ids:
                    next_generated_id += 1
                task_id = next_generated_id
                next_generated_id += 1

            used_ids.add(task_id)
            normalized.append(
                (
                    task_id,
                    position,
                    str(task.get("name", "")).strip(),
                    str(task.get("status", "Not started")).strip() or "Not started",
                    self._normalize_area(task.get("team", ""), task.get("area", "")),
                    self._normalize_mode(task.get("mode", "")),
                    self._normalize_owner(task.get("owner", "")),
                    self._normalize_priority(task.get("priority", "")),
                    self._normalize_time_estimate(task.get("time_estimate", "")),
                    str(task.get("goal", "")).strip(),
                    str(task.get("deadline", "")).strip(),
                    self._normalize_iso_date(task.get("scheduled_date", "")),
                    self._normalize_scheduled_hour(task.get("scheduled_hour", "")),
                    self._normalize_created_at(task.get("created_at", ""), task_id),
                    self._resolve_completed_at(
                        task.get("completed_at", ""),
                        str(task.get("status", "Not started")).strip() or "Not started",
                        *existing_completion.get(task_id, ("", "")),
                    ),
                    str(task.get("notes", "")).strip(),
                )
            )

        team_names = self._normalize_team_names(teams, tasks)
        goal_names = self._normalize_goal_names(goals, tasks)

        with self._connect() as connection:
            connection.execute("BEGIN")
            connection.execute("DELETE FROM tasks")
            connection.executemany(
                """
                INSERT INTO tasks (id, position, name, status, team, mode, owner, priority, time_estimate, goal, deadline, scheduled_date, scheduled_hour, created_at, completed_at, notes)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                [row for row in normalized if row[2]],
            )
            self._replace_teams(connection, team_names)
            self._replace_goals(connection, goal_names)
            connection.commit()

    def create_task(self, task: dict[str, Any]) -> dict[str, Any]:
        normalized = self._normalize_task_payload(task, require_name=True)

        with self._connect() as connection:
            position = connection.execute(
                "SELECT COALESCE(MAX(position), -1) + 1 FROM tasks"
            ).fetchone()[0]
            cursor = connection.execute(
                """
                INSERT INTO tasks (position, name, status, team, mode, owner, priority, time_estimate, goal, deadline, scheduled_date, scheduled_hour, created_at, completed_at, notes)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    position,
                    normalized["name"],
                    normalized["status"],
                    normalized["team"],
                    normalized["mode"],
                    normalized["owner"],
                    normalized["priority"],
                    normalized["time_estimate"],
                    normalized["goal"],
                    normalized["deadline"],
                    normalized["scheduled_date"],
                    normalized["scheduled_hour"],
                    normalized["created_at"],
                    normalized["completed_at"],
                    normalized["notes"],
                ),
            )
            if normalized["team"]:
                self._ensure_team(connection, normalized["team"])
            if normalized["goal"]:
                self._ensure_goal(connection, normalized["goal"])
            task_id = cursor.lastrowid
            connection.commit()

        created = self.fetch_task(int(task_id))
        if created is None:
            raise RuntimeError("Created task could not be loaded")
        return created

    def update_task(self, task_id: int, patch: dict[str, Any]) -> dict[str, Any] | None:
        existing = self.fetch_task(task_id)
        if existing is None:
            return None

        merged = {**existing, **patch, "id": task_id}
        normalized = self._normalize_task_payload(
            merged,
            require_name=True,
            existing_status=str(existing.get("status", "")).strip(),
            existing_completed_at=str(existing.get("completed_at", "")).strip(),
        )

        with self._connect() as connection:
            connection.execute(
                """
                UPDATE tasks
                SET name = ?, status = ?, team = ?, mode = ?, owner = ?, priority = ?, time_estimate = ?, goal = ?, deadline = ?, scheduled_date = ?, scheduled_hour = ?, created_at = ?, completed_at = ?, notes = ?
                WHERE id = ?
                """,
                (
                    normalized["name"],
                    normalized["status"],
                    normalized["team"],
                    normalized["mode"],
                    normalized["owner"],
                    normalized["priority"],
                    normalized["time_estimate"],
                    normalized["goal"],
                    normalized["deadline"],
                    normalized["scheduled_date"],
                    normalized["scheduled_hour"],
                    normalized["created_at"],
                    normalized["completed_at"],
                    normalized["notes"],
                    task_id,
                ),
            )
            if normalized["team"]:
                self._ensure_team(connection, normalized["team"])
            if normalized["goal"]:
                self._ensure_goal(connection, normalized["goal"])
            connection.commit()

        return self.fetch_task(task_id)

    def delete_task(self, task_id: int) -> bool:
        with self._connect() as connection:
            row = connection.execute(
                "SELECT position FROM tasks WHERE id = ?",
                (task_id,),
            ).fetchone()
            if row is None:
                return False

            position = row["position"]
            connection.execute("DELETE FROM tasks WHERE id = ?", (task_id,))
            connection.execute(
                "UPDATE tasks SET position = position - 1 WHERE position > ?",
                (position,),
            )
            connection.commit()

        return True

    def _normalize_task_payload(
        self,
        task: dict[str, Any],
        *,
        require_name: bool,
        existing_status: str = "",
        existing_completed_at: str = "",
    ) -> dict[str, str]:
        name = str(task.get("name", "")).strip()
        if require_name and not name:
            raise ValueError("Task name is required")

        return {
            "name": name,
            "status": str(task.get("status", "Not started")).strip() or "Not started",
            "team": self._normalize_area(task.get("team", ""), task.get("area", "")),
            "mode": self._normalize_mode(task.get("mode", "")),
            "owner": self._normalize_owner(task.get("owner", "")),
            "priority": self._normalize_priority(task.get("priority", "")),
            "time_estimate": self._normalize_time_estimate(task.get("time_estimate", "")),
            "goal": str(task.get("goal", "")).strip(),
            "deadline": str(task.get("deadline", "")).strip(),
            "scheduled_date": self._normalize_iso_date(task.get("scheduled_date", "")),
            "scheduled_hour": self._normalize_scheduled_hour(task.get("scheduled_hour", "")),
            "created_at": self._normalize_created_at(
                task.get("created_at", ""),
                task.get("id"),
            ),
            "completed_at": self._resolve_completed_at(
                task.get("completed_at", ""),
                str(task.get("status", "Not started")).strip() or "Not started",
                existing_status,
                existing_completed_at,
            ),
            "notes": str(task.get("notes", "")).strip(),
        }

    def _derive_team_names(self, connection: sqlite3.Connection) -> list[str]:
        rows = connection.execute(
            """
            SELECT team
            FROM tasks
            WHERE TRIM(team) != ''
            GROUP BY team
            ORDER BY MIN(position), team
            """
        ).fetchall()
        task_teams = [str(row["team"]).strip() for row in rows if str(row["team"]).strip()]
        return self._merge_team_names(task_teams, [])

    def _derive_goal_names(self, connection: sqlite3.Connection) -> list[str]:
        rows = connection.execute(
            """
            SELECT goal
            FROM tasks
            WHERE TRIM(goal) != ''
            GROUP BY goal
            ORDER BY MIN(position), goal
            """
        ).fetchall()
        task_goals = [str(row["goal"]).strip() for row in rows if str(row["goal"]).strip()]
        return self._merge_goal_names(task_goals, [])

    def _normalize_team_names(
        self,
        teams: list[str] | None,
        tasks: list[dict[str, Any]],
    ) -> list[str]:
        task_teams = []
        seen_task_teams: set[str] = set()
        for task in tasks:
            team = str(task.get("team", "")).strip()
            if not team or team in seen_task_teams:
                continue
            seen_task_teams.add(team)
            task_teams.append(team)

        provided_teams = []
        if teams:
            seen_provided: set[str] = set()
            for team in teams:
                name = str(team or "").strip()
                if not name or name in seen_provided:
                    continue
                seen_provided.add(name)
                provided_teams.append(name)

        return self._merge_team_names(task_teams, provided_teams)

    def _normalize_goal_names(
        self,
        goals: list[str] | None,
        tasks: list[dict[str, Any]],
    ) -> list[str]:
        task_goals = []
        seen_task_goals: set[str] = set()
        for task in tasks:
            goal = str(task.get("goal", "")).strip()
            if not goal or goal in seen_task_goals:
                continue
            seen_task_goals.add(goal)
            task_goals.append(goal)

        provided_goals = []
        if goals:
            seen_provided: set[str] = set()
            for goal in goals:
                name = str(goal or "").strip()
                if not name or name in seen_provided:
                    continue
                seen_provided.add(name)
                provided_goals.append(name)

        return self._merge_goal_names(task_goals, provided_goals)

    def _merge_team_names(self, task_teams: list[str], ordered_teams: list[str]) -> list[str]:
        merged = []
        seen: set[str] = set()

        for team in ordered_teams:
            if team in seen:
                continue
            seen.add(team)
            merged.append(team)

        for team in task_teams:
            if team in seen:
                continue
            seen.add(team)
            merged.append(team)

        for team in DEFAULT_TEAMS:
            if team in seen:
                continue
            seen.add(team)
            merged.append(team)

        return merged

    def _merge_goal_names(self, task_goals: list[str], ordered_goals: list[str]) -> list[str]:
        merged = []
        seen: set[str] = set()

        for goal in ordered_goals:
            if goal in seen:
                continue
            seen.add(goal)
            merged.append(goal)

        for goal in task_goals:
            if goal in seen:
                continue
            seen.add(goal)
            merged.append(goal)

        return merged

    def _replace_teams(self, connection: sqlite3.Connection, team_names: list[str]) -> None:
        connection.execute("DELETE FROM teams")
        connection.executemany(
            "INSERT INTO teams (name, position) VALUES (?, ?)",
            [(team, position) for position, team in enumerate(team_names)],
        )

    def _replace_goals(self, connection: sqlite3.Connection, goal_names: list[str]) -> None:
        connection.execute("DELETE FROM goals")
        connection.executemany(
            "INSERT INTO goals (name, position) VALUES (?, ?)",
            [(goal, position) for position, goal in enumerate(goal_names)],
        )

    def _ensure_team(self, connection: sqlite3.Connection, team_name: str) -> None:
        existing = connection.execute(
            "SELECT 1 FROM teams WHERE name = ?",
            (team_name,),
        ).fetchone()
        if existing is not None:
            return

        position = connection.execute(
            "SELECT COALESCE(MAX(position), -1) + 1 FROM teams"
        ).fetchone()[0]
        connection.execute(
            "INSERT INTO teams (name, position) VALUES (?, ?)",
            (team_name, position),
        )

    def _ensure_goal(self, connection: sqlite3.Connection, goal_name: str) -> None:
        existing = connection.execute(
            "SELECT 1 FROM goals WHERE name = ?",
            (goal_name,),
        ).fetchone()
        if existing is not None:
            return

        position = connection.execute(
            "SELECT COALESCE(MAX(position), -1) + 1 FROM goals"
        ).fetchone()[0]
        connection.execute(
            "INSERT INTO goals (name, position) VALUES (?, ?)",
            (goal_name, position),
        )

    def _normalize_area(self, team: Any = "", area: Any = "") -> str:
        return str(area or team or "").strip()

    def _normalize_mode(self, value: Any) -> str:
        raw = str(value or "").strip().lower()
        if raw == "run":
            return "Run"
        if raw == "change":
            return "Change"
        return ""

    def _normalize_owner(self, value: Any) -> str:
        raw = str(value or "").strip().lower()
        if raw in {"me", "self"}:
            return "Me"
        if raw in {"delegate", "delegated"}:
            return "Delegate"
        return ""

    def _normalize_priority(self, value: Any) -> str:
        raw = str(value or "").strip().lower()
        if raw in {"must", "p1", "critical"}:
            return "Must"
        if raw in {"should", "p2"}:
            return "Should"
        if raw in {"could", "p3"}:
            return "Could"
        if raw in {"needs refinement", "refine", "thought", "idea", "draft", "clarify"}:
            return "Needs refinement"
        return ""

    def _normalize_time_estimate(self, value: Any) -> str:
        raw = str(value or "").strip()
        allowed = {"<5m", "15m", "30m", "1h", "2h+"}
        return raw if raw in allowed else ""

    def _normalize_scheduled_hour(self, value: Any) -> str:
        raw = str(value or "").strip()
        allowed = {
            "08:00", "09:00", "10:00", "11:00", "12:00",
            "13:00", "14:00", "15:00", "16:00", "17:00",
        }
        return raw if raw in allowed else ""

    def _normalize_created_at(self, value: Any, task_id: Any = None) -> str:
        normalized = self._normalize_iso_date(value)
        if normalized:
            return normalized
        return self._infer_created_at(task_id)

    def _load_calendar_feed(self, feed_url: str) -> str:
        now = time.monotonic()
        if (
            self._calendar_cache["url"] == feed_url
            and now - float(self._calendar_cache["fetched_at"]) < 300
            and self._calendar_cache["raw"]
        ):
            return str(self._calendar_cache["raw"])

        request = urllib.request.Request(
            feed_url,
            headers={"User-Agent": "TaskAtlas/1.0"},
        )
        with urllib.request.urlopen(request, timeout=10) as response:
            raw = response.read().decode("utf-8", errors="replace")

        self._calendar_cache = {"url": feed_url, "fetched_at": now, "raw": raw}
        return raw

    def _extract_calendar_events(
        self,
        raw_calendar: str,
        start: str,
        days: int,
    ) -> list[dict[str, str]]:
        start_day = datetime.strptime(start, "%Y-%m-%d")
        end_day = start_day + timedelta(days=days)
        unfolded = self._unfold_ics_lines(raw_calendar)
        events: list[dict[str, str]] = []
        current: dict[str, str] | None = None

        for line in unfolded:
            if line == "BEGIN:VEVENT":
                current = {}
                continue
            if line == "END:VEVENT":
                if current:
                    event = self._normalize_calendar_event(current, start_day, end_day)
                    if event:
                        events.append(event)
                current = None
                continue
            if current is None or ":" not in line:
                continue

            key, value = line.split(":", 1)
            current[key] = value

        events.sort(key=lambda event: (event["start"], event["summary"].lower()))
        return events

    def _unfold_ics_lines(self, raw_calendar: str) -> list[str]:
        lines: list[str] = []
        for raw_line in raw_calendar.splitlines():
            line = raw_line.rstrip("\r")
            if not lines:
                lines.append(line)
                continue
            if line.startswith(" ") or line.startswith("\t"):
                lines[-1] += line[1:]
            else:
                lines.append(line)
        return lines

    def _normalize_calendar_event(
        self,
        event: dict[str, str],
        range_start: datetime,
        range_end: datetime,
    ) -> dict[str, str] | None:
        start_key = next((key for key in event if key.startswith("DTSTART")), "")
        end_key = next((key for key in event if key.startswith("DTEND")), "")
        if not start_key:
            return None

        start_value = event[start_key]
        end_value = event.get(end_key, "")
        start_dt, all_day = self._parse_ics_datetime(start_key, start_value)
        if start_dt is None:
            return None

        if end_value:
            end_dt, _ = self._parse_ics_datetime(end_key, end_value)
        else:
            end_dt = start_dt + (timedelta(days=1) if all_day else timedelta(hours=1))

        if end_dt is None:
            return None

        if end_dt <= range_start or start_dt >= range_end:
            return None

        summary = self._decode_ics_text(event.get("SUMMARY", "Busy"))
        return {
            "summary": summary,
            "start": start_dt.isoformat(timespec="minutes"),
            "end": end_dt.isoformat(timespec="minutes"),
            "all_day": "true" if all_day else "false",
        }

    def _parse_ics_datetime(
        self,
        key: str,
        value: str,
    ) -> tuple[datetime | None, bool]:
        if "VALUE=DATE" in key:
            try:
                return datetime.strptime(value[:8], "%Y%m%d"), True
            except ValueError:
                return None, True

        raw = value.strip()
        is_utc = raw.endswith("Z")
        if is_utc:
            raw = raw[:-1]

        try:
            parsed = datetime.strptime(raw[:15], "%Y%m%dT%H%M%S")
        except ValueError:
            try:
                parsed = datetime.strptime(raw[:13], "%Y%m%dT%H%M")
            except ValueError:
                return None, False

        if is_utc:
            parsed = parsed.replace(tzinfo=UTC).astimezone().replace(tzinfo=None)

        return parsed, False

    def _decode_ics_text(self, value: str) -> str:
        return (
            str(value or "")
            .replace("\\n", " / ")
            .replace("\\,", ",")
            .replace("\\;", ";")
            .replace("\\\\", "\\")
            .strip()
        )

    def _infer_created_at(self, task_id: Any) -> str:
        try:
            numeric_id = int(task_id)
        except (TypeError, ValueError):
            return datetime.now().date().isoformat()

        if numeric_id >= 10**11:
            try:
                return datetime.fromtimestamp(numeric_id / 1000).date().isoformat()
            except (OverflowError, OSError, ValueError):
                pass

        return datetime.now().date().isoformat()

    def _normalize_iso_date(self, value: Any) -> str:
        raw = str(value or "").strip()
        if len(raw) >= 10:
            candidate = raw[:10]
            try:
                datetime.strptime(candidate, "%Y-%m-%d")
                return candidate
            except ValueError:
                pass
        return ""

    def _resolve_completed_at(
        self,
        value: Any,
        status: str,
        existing_status: str = "",
        existing_completed_at: str = "",
    ) -> str:
        if status != "Done":
            return ""

        normalized = self._normalize_iso_date(value)
        if normalized:
            return normalized

        if existing_status == "Done":
            return self._normalize_iso_date(existing_completed_at)

        return datetime.now().date().isoformat()

    def _fetch_completion_context(
        self,
        connection: sqlite3.Connection,
    ) -> dict[int, tuple[str, str]]:
        rows = connection.execute(
            "SELECT id, status, completed_at FROM tasks"
        ).fetchall()
        return {
            int(row["id"]): (
                str(row["status"] or "").strip(),
                str(row["completed_at"] or "").strip(),
            )
            for row in rows
        }

    def last_modified(self) -> str:
        if not self.db_file.exists():
            return formatdate(usegmt=True)
        return formatdate(self.db_file.stat().st_mtime, usegmt=True)


class TodoRequestHandler(SimpleHTTPRequestHandler):
    def __init__(self, *args, directory: str, store: TodoStore, **kwargs):
        self.store = store
        super().__init__(*args, directory=directory, **kwargs)

    def do_GET(self) -> None:
        if self._is_state_endpoint():
            self._serve_state(include_body=True)
            return
        if self._is_calendar_events_endpoint():
            self._serve_calendar_events(include_body=True)
            return
        if self._is_tasks_collection_endpoint():
            self._serve_tasks(include_body=True)
            return
        task_id = self._task_id_from_path()
        if task_id is not None:
            self._serve_task(task_id, include_body=True)
            return
        super().do_GET()

    def do_HEAD(self) -> None:
        if self._is_state_endpoint():
            self._serve_state(include_body=False)
            return
        if self._is_calendar_events_endpoint():
            self._serve_calendar_events(include_body=False)
            return
        if self._is_tasks_collection_endpoint():
            self._serve_tasks(include_body=False)
            return
        task_id = self._task_id_from_path()
        if task_id is not None:
            self._serve_task(task_id, include_body=False)
            return
        super().do_HEAD()

    def do_POST(self) -> None:
        if not self._is_tasks_collection_endpoint():
            self.send_error(HTTPStatus.NOT_FOUND, "Unknown API endpoint")
            return

        payload = self._read_json_body()
        if payload is None:
            return

        try:
            created = self.store.create_task(payload)
        except ValueError as error:
            self.send_error(HTTPStatus.BAD_REQUEST, str(error))
            return

        self._send_json(HTTPStatus.CREATED, created)

    def do_PUT(self) -> None:
        if self._is_calendar_feed_endpoint():
            payload = self._read_json_body()
            if payload is None:
                return
            self.store.update_calendar_feed_url(payload.get("feed_url", ""))
            self.send_response(HTTPStatus.NO_CONTENT)
            self.send_header("Last-Modified", self.store.last_modified())
            self.send_header("Cache-Control", "no-store")
            self.end_headers()
            return

        if not self._is_state_endpoint():
            self.send_error(HTTPStatus.NOT_FOUND, "Unknown API endpoint")
            return

        payload = self._read_json_body()
        if payload is None:
            return

        tasks = payload.get("tasks")
        if not isinstance(tasks, list):
            self.send_error(HTTPStatus.BAD_REQUEST, "Expected tasks array")
            return

        teams = payload.get("teams")
        if teams is not None and not isinstance(teams, list):
            self.send_error(HTTPStatus.BAD_REQUEST, "Expected teams array")
            return

        goals = payload.get("goals")
        if goals is not None and not isinstance(goals, list):
            self.send_error(HTTPStatus.BAD_REQUEST, "Expected goals array")
            return

        self.store.replace_state(tasks, teams, goals)
        self.send_response(HTTPStatus.NO_CONTENT)
        self.send_header("Last-Modified", self.store.last_modified())
        self.send_header("Cache-Control", "no-store")
        self.end_headers()

    def do_PATCH(self) -> None:
        task_id = self._task_id_from_path()
        if task_id is None:
            self.send_error(HTTPStatus.NOT_FOUND, "Unknown API endpoint")
            return

        payload = self._read_json_body()
        if payload is None:
            return

        try:
            updated = self.store.update_task(task_id, payload)
        except ValueError as error:
            self.send_error(HTTPStatus.BAD_REQUEST, str(error))
            return

        if updated is None:
            self.send_error(HTTPStatus.NOT_FOUND, "Task not found")
            return

        self._send_json(HTTPStatus.OK, updated)

    def do_DELETE(self) -> None:
        task_id = self._task_id_from_path()
        if task_id is None:
            self.send_error(HTTPStatus.NOT_FOUND, "Unknown API endpoint")
            return

        deleted = self.store.delete_task(task_id)
        if not deleted:
            self.send_error(HTTPStatus.NOT_FOUND, "Task not found")
            return

        self.send_response(HTTPStatus.NO_CONTENT)
        self.send_header("Last-Modified", self.store.last_modified())
        self.send_header("Cache-Control", "no-store")
        self.end_headers()

    def end_headers(self) -> None:
        self.send_header("Access-Control-Allow-Origin", "*")
        super().end_headers()

    def _is_state_endpoint(self) -> bool:
        return urlparse(self.path).path == "/api/state"

    def _is_tasks_collection_endpoint(self) -> bool:
        return urlparse(self.path).path == "/api/tasks"

    def _is_calendar_events_endpoint(self) -> bool:
        return urlparse(self.path).path == "/api/calendar-events"

    def _is_calendar_feed_endpoint(self) -> bool:
        return urlparse(self.path).path == "/api/calendar-feed"

    def _task_id_from_path(self) -> int | None:
        path = urlparse(self.path).path
        prefix = "/api/tasks/"
        if not path.startswith(prefix):
            return None

        suffix = path[len(prefix):]
        if not suffix or "/" in suffix:
            return None

        try:
            return int(suffix)
        except ValueError:
            return None

    def _read_json_body(self) -> dict[str, Any] | None:
        try:
            content_length = int(self.headers.get("Content-Length", "0"))
        except ValueError:
            self.send_error(HTTPStatus.BAD_REQUEST, "Invalid Content-Length")
            return None

        try:
            payload = json.loads(self.rfile.read(content_length) or b"{}")
        except json.JSONDecodeError:
            self.send_error(HTTPStatus.BAD_REQUEST, "Invalid JSON")
            return None

        if not isinstance(payload, dict):
            self.send_error(HTTPStatus.BAD_REQUEST, "Expected JSON object")
            return None

        return payload

    def _send_json(self, status: HTTPStatus, payload: dict[str, Any] | list[dict[str, Any]]) -> None:
        body = json.dumps(payload).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Last-Modified", self.store.last_modified())
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(body)

    def _serve_state(self, *, include_body: bool) -> None:
        payload = json.dumps(
            {
                "tasks": self.store.fetch_tasks(),
                "teams": self.store.fetch_teams(),
                "goals": self.store.fetch_goals(),
                "settings": self.store.fetch_settings(),
            }
        ).encode("utf-8")
        self.send_response(HTTPStatus.OK)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(payload)))
        self.send_header("Last-Modified", self.store.last_modified())
        self.send_header("Cache-Control", "no-store")
        self.end_headers()

        if include_body:
            self.wfile.write(payload)

    def _serve_tasks(self, *, include_body: bool) -> None:
        params = parse_qs(urlparse(self.path).query)
        completed_at = params.get("completed_at", [None])[0]
        if completed_at:
            completed_at = self.store._normalize_iso_date(completed_at)
            if not completed_at:
                self.send_error(
                    HTTPStatus.BAD_REQUEST,
                    "completed_at must be YYYY-MM-DD",
                )
                return

        payload = json.dumps(
            {"tasks": self.store.fetch_tasks(completed_at=completed_at)}
        ).encode("utf-8")
        self.send_response(HTTPStatus.OK)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(payload)))
        self.send_header("Last-Modified", self.store.last_modified())
        self.send_header("Cache-Control", "no-store")
        self.end_headers()

        if include_body:
            self.wfile.write(payload)

    def _serve_calendar_events(self, *, include_body: bool) -> None:
        params = parse_qs(urlparse(self.path).query)
        start = params.get("start", [""])[0]
        days_raw = params.get("days", ["5"])[0]

        try:
            days = max(1, min(14, int(days_raw)))
        except ValueError:
            self.send_error(HTTPStatus.BAD_REQUEST, "days must be an integer")
            return

        try:
            events = self.store.fetch_calendar_events(start, days)
        except ValueError as error:
            self.send_error(HTTPStatus.BAD_REQUEST, str(error))
            return
        except urllib.error.URLError as error:
            self.send_error(
                HTTPStatus.BAD_GATEWAY,
                f"Could not fetch calendar feed: {error.reason}",
            )
            return

        payload = json.dumps({"events": events}).encode("utf-8")
        self.send_response(HTTPStatus.OK)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(payload)))
        self.send_header("Last-Modified", self.store.last_modified())
        self.send_header("Cache-Control", "no-store")
        self.end_headers()

        if include_body:
            self.wfile.write(payload)

    def _serve_task(self, task_id: int, *, include_body: bool) -> None:
        task = self.store.fetch_task(task_id)
        if task is None:
            self.send_error(HTTPStatus.NOT_FOUND, "Task not found")
            return

        payload = json.dumps(task).encode("utf-8")
        self.send_response(HTTPStatus.OK)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(payload)))
        self.send_header("Last-Modified", self.store.last_modified())
        self.send_header("Cache-Control", "no-store")
        self.end_headers()

        if include_body:
            self.wfile.write(payload)


def parse_csv_tasks(raw_csv: str) -> list[dict[str, Any]]:
    reader = csv.DictReader(raw_csv.splitlines())
    tasks: list[dict[str, Any]] = []

    for index, row in enumerate(reader, start=1):
        name = (row.get("Name") or row.get("name") or "").strip()
        if not name:
            continue

        tasks.append(
            {
                "id": index,
                "name": name,
                "status": (row.get("Status") or row.get("status") or "Not started").strip() or "Not started",
                "team": (row.get("Area") or row.get("area") or row.get("Team") or row.get("team") or "").strip(),
                "mode": (row.get("Mode") or row.get("mode") or "").strip(),
                "owner": (row.get("Owner") or row.get("owner") or "").strip(),
                "priority": (row.get("Priority") or row.get("priority") or "").strip(),
                "time_estimate": (
                    row.get("Effort")
                    or row.get("effort")
                    or row.get("Time")
                    or row.get("Time Estimate")
                    or row.get("time_estimate")
                    or row.get("estimate")
                    or ""
                ).strip(),
                "goal": (row.get("Goal") or row.get("goal") or "").strip(),
                "deadline": (row.get("Deadline") or row.get("deadline") or "").strip(),
                "scheduled_date": (row.get("Scheduled Date") or row.get("scheduled_date") or "").strip(),
                "scheduled_hour": (row.get("Scheduled Hour") or row.get("scheduled_hour") or "").strip(),
                "created_at": (row.get("Created") or row.get("created_at") or "").strip(),
                "completed_at": (row.get("Completed") or row.get("completed_at") or "").strip(),
                "notes": (row.get("Notes") or row.get("Description") or row.get("notes") or "").strip(),
            }
        )

    return tasks


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Serve the todo board with a SQLite-backed API.")
    parser.add_argument("--host", default="0.0.0.0")
    parser.add_argument("--port", type=int, default=8000)
    parser.add_argument("--site-dir", required=True)
    parser.add_argument("--db-file", required=True)
    parser.add_argument("--seed-csv")
    parser.add_argument("--init-only", action="store_true")
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    store = TodoStore(args.db_file)
    imported = store.import_csv_once(args.seed_csv)

    if imported:
        print(f"Imported seed CSV into {args.db_file} and removed {args.seed_csv}")

    if args.init_only:
        print(f"Database ready at {args.db_file}")
        return

    handler = functools.partial(
        TodoRequestHandler,
        directory=args.site_dir,
        store=store,
    )
    server = ThreadingHTTPServer((args.host, args.port), handler)
    print(f"Serving site from {args.site_dir}")
    print(f"Using database {args.db_file}")
    print(f"Listening on http://{args.host}:{args.port}")
    server.serve_forever()


if __name__ == "__main__":
    main()
