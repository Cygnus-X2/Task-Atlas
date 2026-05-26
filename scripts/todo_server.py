#!/usr/bin/env python3

from __future__ import annotations

import argparse
import base64
import csv
import functools
import hashlib
import hmac
import json
import os
import re
import secrets
import sqlite3
import time
import urllib.error
import urllib.request
from datetime import datetime, timedelta, timezone
from email.utils import formatdate
from http.cookies import SimpleCookie
from http import HTTPStatus
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from typing import Any
from urllib.parse import parse_qs, quote, urlparse

DEFAULT_TEAMS = [
    "BUH",
    "Process Improvement",
    "Sales",
    "OKR",
    "Product",
    "Projects",
]

UTC = timezone.utc
WEEKDAY_INDEX = {
    "MO": 0,
    "TU": 1,
    "WE": 2,
    "TH": 3,
    "FR": 4,
    "SA": 5,
    "SU": 6,
}

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
    position INTEGER NOT NULL,
    description TEXT NOT NULL DEFAULT ''
);

CREATE TABLE IF NOT EXISTS pages (
    id INTEGER PRIMARY KEY,
    position INTEGER NOT NULL,
    parent_id INTEGER,
    title TEXT NOT NULL,
    body TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL DEFAULT '',
    updated_at TEXT NOT NULL DEFAULT ''
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
            goal_columns = {
                row["name"]
                for row in connection.execute("PRAGMA table_info(goals)").fetchall()
            }
            if "description" not in goal_columns:
                connection.execute(
                    "ALTER TABLE goals ADD COLUMN description TEXT NOT NULL DEFAULT ''"
                )
            page_columns = {
                row["name"]
                for row in connection.execute("PRAGMA table_info(pages)").fetchall()
            }
            if "parent_id" not in page_columns:
                connection.execute("ALTER TABLE pages ADD COLUMN parent_id INTEGER")

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
                goal_entries = self._derive_goal_entries(connection)
                connection.executemany(
                    "INSERT INTO goals (name, position, description) VALUES (?, ?, ?)",
                    [
                        (goal["name"], position, goal["description"])
                        for position, goal in enumerate(goal_entries)
                    ],
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

    def fetch_goals(self) -> list[dict[str, str]]:
        with self._connect() as connection:
            rows = connection.execute(
                "SELECT name, description FROM goals ORDER BY position ASC, name ASC"
            ).fetchall()

        return [
            {
                "name": str(row["name"]),
                "description": str(row["description"] or ""),
            }
            for row in rows
        ]

    def fetch_settings(self) -> dict[str, str]:
        with self._connect() as connection:
            rows = connection.execute(
                "SELECT key, value FROM settings"
            ).fetchall()
        return {str(row["key"]): str(row["value"]) for row in rows}

    def fetch_pages(self) -> list[dict[str, Any]]:
        with self._connect() as connection:
            rows = connection.execute(
                """
                SELECT id, parent_id, title, body, created_at, updated_at
                FROM pages
                ORDER BY position ASC, id ASC
                """
            ).fetchall()

        return [dict(row) for row in rows]

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
            existing_pages = self.fetch_pages()

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
        goal_entries = self._normalize_goals(None, tasks)

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
            self._replace_goals(connection, goal_entries)
            self._replace_pages(connection, self._normalize_pages(existing_pages))
            connection.commit()

    def replace_state(
        self,
        tasks: list[dict[str, Any]],
        teams: list[str] | None = None,
        goals: list[Any] | None = None,
        pages: list[dict[str, Any]] | None = None,
        settings: dict[str, Any] | None = None,
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
        goal_entries = self._normalize_goals(goals, tasks)
        page_entries = self._normalize_pages(
            pages if pages is not None else self.fetch_pages()
        )
        normalized_settings = self._normalize_settings_payload(settings)

        with self._connect() as connection:
            current_settings = {
                str(row["key"]): str(row["value"])
                for row in connection.execute("SELECT key, value FROM settings").fetchall()
            }
            if normalized_settings:
                current_settings.update(normalized_settings)
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
            self._replace_goals(connection, goal_entries)
            self._replace_pages(connection, page_entries)
            self._replace_settings(connection, current_settings)
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
            "goal": self._parse_goal_reference(task.get("goal", ""))[0],
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

    def _derive_goal_entries(self, connection: sqlite3.Connection) -> list[dict[str, str]]:
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
        return self._merge_goals(task_goals, [])

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

    def _normalize_goal_entry(self, goal: Any) -> dict[str, str] | None:
        if isinstance(goal, dict):
            name = str(goal.get("name", "")).strip()
            description = str(goal.get("description", "")).strip()
        else:
            name = str(goal or "").strip()
            description = ""

        name, extracted_description = self._parse_goal_reference(name)
        if not description:
            description = extracted_description

        if not name:
            return None

        return {"name": name, "description": description}

    def _normalize_goals(
        self,
        goals: list[Any] | None,
        tasks: list[dict[str, Any]],
    ) -> list[dict[str, str]]:
        task_goals = []
        seen_task_goals: set[str] = set()
        for task in tasks:
            goal, _ = self._parse_goal_reference(task.get("goal", ""))
            if not goal or goal in seen_task_goals:
                continue
            seen_task_goals.add(goal)
            task_goals.append(goal)

        provided_goals: list[dict[str, str]] = []
        if goals:
            seen_provided: set[str] = set()
            for goal in goals:
                entry = self._normalize_goal_entry(goal)
                if entry is None or entry["name"] in seen_provided:
                    continue
                seen_provided.add(entry["name"])
                provided_goals.append(entry)

        return self._merge_goals(task_goals, provided_goals)

    def _parse_goal_reference(self, value: Any) -> tuple[str, str]:
        name = str(value or "").strip()
        description = ""
        iterations = 0

        while name and iterations < 6:
            next_name = self._extract_structured_field(name, "name")
            if not next_name or next_name == name:
                break
            next_description = self._extract_structured_field(name, "description")
            name = next_name.strip()
            if not description and next_description:
                description = next_description.strip()
            iterations += 1

        return name, description

    def _extract_structured_field(self, source: Any, field_name: str) -> str:
        text = str(source or "").strip()
        pattern = re.compile(rf"""["']{re.escape(field_name)}["']\s*:\s*(["'])(.*?)\1""")
        match = pattern.search(text)
        return match.group(2) if match else ""

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

    def _normalize_settings_payload(
        self, settings: dict[str, Any] | None
    ) -> dict[str, str]:
        if not isinstance(settings, dict):
            return {}

        normalized: dict[str, str] = {}
        for key, value in settings.items():
            name = str(key or "").strip()
            if not name:
                continue
            normalized[name] = str(value or "")

        return normalized

    def _merge_goals(
        self,
        task_goals: list[str],
        ordered_goals: list[dict[str, str]],
    ) -> list[dict[str, str]]:
        merged: list[dict[str, str]] = []
        seen: set[str] = set()

        for goal in ordered_goals:
            name = str(goal.get("name", "")).strip()
            if not name or name in seen:
                continue
            seen.add(name)
            merged.append(
                {
                    "name": name,
                    "description": str(goal.get("description", "")).strip(),
                }
            )

        for goal_name in task_goals:
            if goal_name in seen:
                continue
            seen.add(goal_name)
            merged.append({"name": goal_name, "description": ""})

        return merged

    def _replace_teams(self, connection: sqlite3.Connection, team_names: list[str]) -> None:
        connection.execute("DELETE FROM teams")
        connection.executemany(
            "INSERT INTO teams (name, position) VALUES (?, ?)",
            [(team, position) for position, team in enumerate(team_names)],
        )

    def _replace_settings(
        self,
        connection: sqlite3.Connection,
        settings: dict[str, str],
    ) -> None:
        connection.execute("DELETE FROM settings")
        connection.executemany(
            "INSERT INTO settings (key, value) VALUES (?, ?)",
            [(key, value) for key, value in settings.items() if str(key).strip()],
        )

    def _replace_goals(
        self,
        connection: sqlite3.Connection,
        goal_entries: list[dict[str, str]],
    ) -> None:
        connection.execute("DELETE FROM goals")
        connection.executemany(
            "INSERT INTO goals (name, position, description) VALUES (?, ?, ?)",
            [
                (goal["name"], position, goal["description"])
                for position, goal in enumerate(goal_entries)
            ],
        )

    def _replace_pages(
        self,
        connection: sqlite3.Connection,
        pages: list[dict[str, Any]],
    ) -> None:
        connection.execute("DELETE FROM pages")
        connection.executemany(
            """
            INSERT INTO pages (id, position, parent_id, title, body, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?)
            """,
            [
                (
                    page["id"],
                    position,
                    page["parent_id"],
                    page["title"],
                    page["body"],
                    page["created_at"],
                    page["updated_at"],
                )
                for position, page in enumerate(pages)
            ],
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

    def _ensure_goal(
        self,
        connection: sqlite3.Connection,
        goal_name: str,
        description: str = "",
    ) -> None:
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
            "INSERT INTO goals (name, position, description) VALUES (?, ?, ?)",
            (goal_name, position, str(description or "").strip()),
        )

    def _normalize_area(self, team: Any = "", area: Any = "") -> str:
        return str(area or team or "").strip()

    def _normalize_pages(self, pages: list[dict[str, Any]] | None) -> list[dict[str, Any]]:
        normalized: list[dict[str, Any]] = []
        seen_ids: set[int] = set()
        next_generated_id = 1
        raw_parent_ids: dict[int, int | None] = {}

        for page in pages or []:
            if not isinstance(page, dict):
                continue
            raw_id = page.get("id")
            page_id = raw_id if isinstance(raw_id, int) and raw_id > 0 else None
            while page_id is None or page_id in seen_ids:
                while next_generated_id in seen_ids:
                    next_generated_id += 1
                page_id = next_generated_id
                next_generated_id += 1

            title = str(page.get("title", "")).strip() or "Untitled page"
            body = str(page.get("body", "")).rstrip()
            created_at = self._normalize_timestamp(page.get("created_at", ""))
            updated_at = self._normalize_timestamp(page.get("updated_at", ""))
            if not created_at:
                created_at = self._now_timestamp()
            if not updated_at:
                updated_at = created_at

            seen_ids.add(page_id)
            raw_parent = page.get("parent_id")
            raw_parent_ids[page_id] = (
                raw_parent
                if isinstance(raw_parent, int) and raw_parent > 0
                else None
            )
            normalized.append(
                {
                    "id": page_id,
                    "parent_id": None,
                    "title": title,
                    "body": body,
                    "created_at": created_at,
                    "updated_at": updated_at,
                }
            )

        id_set = {page["id"] for page in normalized}
        for page in normalized:
            parent_id = raw_parent_ids.get(page["id"])
            if parent_id is None or parent_id == page["id"] or parent_id not in id_set:
                page["parent_id"] = None
            else:
                page["parent_id"] = parent_id

        return normalized

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

    def _normalize_timestamp(self, value: Any) -> str:
        raw = str(value or "").strip()
        if not raw:
            return ""
        try:
            parsed = datetime.fromisoformat(raw.replace("Z", "+00:00"))
        except ValueError:
            return ""
        return parsed.astimezone(UTC).isoformat(timespec="seconds")

    def _now_timestamp(self) -> str:
        return datetime.now(UTC).isoformat(timespec="seconds")

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
        raw_events: list[dict[str, str]] = []
        current: dict[str, str] | None = None

        for line in unfolded:
            if line == "BEGIN:VEVENT":
                current = {}
                continue
            if line == "END:VEVENT":
                if current:
                    raw_events.append(current)
                current = None
                continue
            if current is None or ":" not in line:
                continue

            key, value = line.split(":", 1)
            if key in current:
                current[key] = f"{current[key]}\n{value}"
            else:
                current[key] = value

        events: list[dict[str, str]] = []
        recurring_events: list[dict[str, str]] = []
        overrides: dict[tuple[str, str], dict[str, str]] = {}

        for raw_event in raw_events:
            recurrence_key = self._get_calendar_recurrence_key(raw_event)
            uid = str(raw_event.get("UID", "")).strip()
            if recurrence_key and uid:
                overrides[(uid, recurrence_key)] = raw_event

            if recurrence_key:
                event = self._normalize_calendar_event(raw_event, start_day, end_day)
                if event:
                    events.append(event)
                continue

            if "RRULE" in raw_event:
                recurring_events.append(raw_event)
                continue

            event = self._normalize_calendar_event(raw_event, start_day, end_day)
            if event:
                events.append(event)

        for raw_event in recurring_events:
            events.extend(
                self._expand_recurring_calendar_event(
                    raw_event,
                    overrides=overrides,
                    range_start=start_day,
                    range_end=end_day,
                )
            )

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
        start_info = self._get_calendar_datetime_field(event, "DTSTART")
        if start_info is None:
            return None

        start_dt, end_dt, all_day = start_info
        if start_dt is None or end_dt is None:
            return None

        if end_dt <= range_start or start_dt >= range_end:
            return None

        summary = self._decode_ics_text(event.get("SUMMARY", "Busy"))
        blocking = self._is_calendar_event_blocking(event)
        return {
            "summary": summary,
            "start": start_dt.isoformat(timespec="minutes"),
            "end": end_dt.isoformat(timespec="minutes"),
            "all_day": "true" if all_day else "false",
            "blocking": "true" if blocking else "false",
        }

    def _expand_recurring_calendar_event(
        self,
        event: dict[str, str],
        *,
        overrides: dict[tuple[str, str], dict[str, str]],
        range_start: datetime,
        range_end: datetime,
    ) -> list[dict[str, str]]:
        start_info = self._get_calendar_datetime_field(event, "DTSTART")
        if start_info is None:
            return []

        start_dt, end_dt, all_day = start_info
        if start_dt is None or end_dt is None:
            return []

        rule = self._parse_calendar_rrule(str(event.get("RRULE", "")).strip())
        if not rule:
            normalized = self._normalize_calendar_event(event, range_start, range_end)
            return [normalized] if normalized else []

        uid = str(event.get("UID", "")).strip()
        duration = end_dt - start_dt
        if duration <= timedelta(0):
            duration = timedelta(days=1) if all_day else timedelta(hours=1)

        suppressed = self._get_calendar_exdates(event)
        summary = self._decode_ics_text(event.get("SUMMARY", "Busy"))
        blocking = self._is_calendar_event_blocking(event)
        events: list[dict[str, str]] = []

        for occurrence_start in self._iter_calendar_occurrences(
            start_dt,
            all_day=all_day,
            rule=rule,
            duration=duration,
            range_start=range_start,
            range_end=range_end,
        ):
            recurrence_key = self._format_calendar_occurrence_key(occurrence_start, all_day)
            if recurrence_key in suppressed:
                continue
            if uid and (uid, recurrence_key) in overrides:
                continue

            occurrence_end = occurrence_start + duration
            if occurrence_end <= range_start or occurrence_start >= range_end:
                continue

            events.append(
                {
                    "summary": summary,
                    "start": occurrence_start.isoformat(timespec="minutes"),
                    "end": occurrence_end.isoformat(timespec="minutes"),
                    "all_day": "true" if all_day else "false",
                    "blocking": "true" if blocking else "false",
                }
            )

        return events

    def _get_calendar_datetime_field(
        self,
        event: dict[str, str],
        prefix: str,
    ) -> tuple[datetime, datetime, bool] | None:
        start_key = next((key for key in event if key.startswith(prefix)), "")
        if not start_key:
            return None

        start_dt, all_day = self._parse_ics_datetime(start_key, event[start_key])
        if start_dt is None:
            return None

        end_prefix = "DTEND" if prefix == "DTSTART" else ""
        end_dt: datetime | None = None
        if end_prefix:
            end_key = next((key for key in event if key.startswith(end_prefix)), "")
            end_value = event.get(end_key, "")
            if end_value:
                end_dt, _ = self._parse_ics_datetime(end_key, end_value)

        if end_dt is None:
            end_dt = start_dt + (timedelta(days=1) if all_day else timedelta(hours=1))

        return start_dt, end_dt, all_day

    def _get_calendar_recurrence_key(self, event: dict[str, str]) -> str:
        recurrence_key = next((key for key in event if key.startswith("RECURRENCE-ID")), "")
        if not recurrence_key:
            return ""

        recurrence_dt, all_day = self._parse_ics_datetime(recurrence_key, event[recurrence_key])
        if recurrence_dt is None:
            return ""

        return self._format_calendar_occurrence_key(recurrence_dt, all_day)

    def _format_calendar_occurrence_key(self, occurrence: datetime, all_day: bool) -> str:
        return occurrence.date().isoformat() if all_day else occurrence.isoformat(timespec="minutes")

    def _parse_calendar_rrule(self, raw_rule: str) -> dict[str, str]:
        if not raw_rule:
            return {}

        rule: dict[str, str] = {}
        for chunk in raw_rule.split(";"):
            if "=" not in chunk:
                continue
            key, value = chunk.split("=", 1)
            key = key.strip().upper()
            value = value.strip()
            if key:
                rule[key] = value
        return rule

    def _get_calendar_exdates(self, event: dict[str, str]) -> set[str]:
        exdates: set[str] = set()
        for key, raw_value in event.items():
            if not key.startswith("EXDATE"):
                continue
            for group in str(raw_value or "").splitlines():
                for value in group.split(","):
                    value = value.strip()
                    if not value:
                        continue
                    parsed, all_day = self._parse_ics_datetime(key, value)
                    if parsed is None:
                        continue
                    exdates.add(self._format_calendar_occurrence_key(parsed, all_day))
        return exdates

    def _iter_calendar_occurrences(
        self,
        start_dt: datetime,
        *,
        all_day: bool,
        rule: dict[str, str],
        duration: timedelta,
        range_start: datetime,
        range_end: datetime,
    ) -> list[datetime]:
        frequency = rule.get("FREQ", "").upper()
        if frequency not in {"DAILY", "WEEKLY", "MONTHLY", "YEARLY"}:
            return [start_dt]

        until = self._parse_rrule_until(rule.get("UNTIL", ""), all_day)
        lookback_days = max(1, int(duration.total_seconds() // 86400) + 1)
        candidate_day = (range_start - timedelta(days=lookback_days)).date()
        last_day = range_end.date()
        occurrences: list[datetime] = []

        while candidate_day <= last_day:
            candidate_dt = datetime.combine(candidate_day, start_dt.time())
            if all_day:
                candidate_dt = datetime(candidate_day.year, candidate_day.month, candidate_day.day)

            if candidate_dt >= start_dt and self._matches_calendar_recurrence(
                start_dt,
                candidate_dt,
                rule,
                frequency=frequency,
            ):
                if until is None or candidate_dt <= until:
                    occurrences.append(candidate_dt)
            candidate_day += timedelta(days=1)

        return occurrences

    def _matches_calendar_recurrence(
        self,
        start_dt: datetime,
        candidate_dt: datetime,
        rule: dict[str, str],
        *,
        frequency: str,
    ) -> bool:
        interval = max(1, self._parse_int(rule.get("INTERVAL", "1"), default=1))
        byday = self._parse_rrule_byday(rule.get("BYDAY", ""))
        bymonth = self._parse_rrule_int_list(rule.get("BYMONTH", ""))
        bymonthday = self._parse_rrule_int_list(rule.get("BYMONTHDAY", ""))

        if frequency == "DAILY":
            days_apart = (candidate_dt.date() - start_dt.date()).days
            return days_apart >= 0 and days_apart % interval == 0

        if frequency == "WEEKLY":
            week_start = WEEKDAY_INDEX.get(rule.get("WKST", "MO").upper(), 0)
            start_week = start_dt.date() - timedelta(days=(start_dt.weekday() - week_start) % 7)
            candidate_week = candidate_dt.date() - timedelta(days=(candidate_dt.weekday() - week_start) % 7)
            weeks_apart = (candidate_week - start_week).days // 7
            if weeks_apart < 0 or weeks_apart % interval != 0:
                return False
            weekdays = {weekday for _, weekday in byday} if byday else {start_dt.weekday()}
            return candidate_dt.weekday() in weekdays

        if frequency == "MONTHLY":
            months_apart = (candidate_dt.year - start_dt.year) * 12 + (candidate_dt.month - start_dt.month)
            if months_apart < 0 or months_apart % interval != 0:
                return False
            return self._matches_calendar_month_rules(
                candidate_dt,
                start_dt=start_dt,
                byday=byday,
                bymonthday=bymonthday,
            )

        years_apart = candidate_dt.year - start_dt.year
        if years_apart < 0 or years_apart % interval != 0:
            return False
        if bymonth and candidate_dt.month not in bymonth:
            return False
        if not bymonth and candidate_dt.month != start_dt.month:
            return False
        return self._matches_calendar_month_rules(
            candidate_dt,
            start_dt=start_dt,
            byday=byday,
            bymonthday=bymonthday,
        )

    def _matches_calendar_month_rules(
        self,
        candidate_dt: datetime,
        *,
        start_dt: datetime,
        byday: list[tuple[int | None, int]],
        bymonthday: list[int],
    ) -> bool:
        if bymonthday:
            valid_days = {
                self._resolve_rrule_month_day(candidate_dt.year, candidate_dt.month, month_day)
                for month_day in bymonthday
            }
            return candidate_dt.day in valid_days

        if byday:
            return any(
                self._candidate_matches_byday(candidate_dt, ordinal=ordinal, weekday=weekday)
                for ordinal, weekday in byday
            )

        return candidate_dt.day == start_dt.day

    def _candidate_matches_byday(
        self,
        candidate_dt: datetime,
        *,
        ordinal: int | None,
        weekday: int,
    ) -> bool:
        if candidate_dt.weekday() != weekday:
            return False
        if ordinal is None:
            return True

        if ordinal > 0:
            occurrence_index = ((candidate_dt.day - 1) // 7) + 1
            return occurrence_index == ordinal

        next_same_weekday = candidate_dt + timedelta(days=7)
        return next_same_weekday.month != candidate_dt.month and ordinal == -1

    def _resolve_rrule_month_day(self, year: int, month: int, month_day: int) -> int:
        if month_day > 0:
            return month_day

        next_month = datetime(year + (month // 12), (month % 12) + 1, 1)
        last_day = (next_month - timedelta(days=1)).day
        return last_day + month_day + 1

    def _parse_rrule_until(self, raw_until: str, all_day: bool) -> datetime | None:
        value = str(raw_until or "").strip()
        if not value:
            return None

        if len(value) == 8 and value.isdigit():
            try:
                parsed = datetime.strptime(value, "%Y%m%d")
            except ValueError:
                return None
            if not all_day:
                parsed = parsed.replace(hour=23, minute=59, second=59)
            return parsed

        parsed, _ = self._parse_ics_datetime("UNTIL", value)
        return parsed

    def _parse_rrule_byday(self, raw_value: str) -> list[tuple[int | None, int]]:
        values: list[tuple[int | None, int]] = []
        for chunk in str(raw_value or "").split(","):
            token = chunk.strip().upper()
            if not token:
                continue
            match = re.fullmatch(r"([+-]?\d+)?([A-Z]{2})", token)
            if not match:
                continue
            ordinal_raw, weekday_raw = match.groups()
            weekday = WEEKDAY_INDEX.get(weekday_raw)
            if weekday is None:
                continue
            ordinal = int(ordinal_raw) if ordinal_raw else None
            values.append((ordinal, weekday))
        return values

    def _parse_rrule_int_list(self, raw_value: str) -> list[int]:
        values: list[int] = []
        for chunk in str(raw_value or "").split(","):
            chunk = chunk.strip()
            if not chunk:
                continue
            try:
                values.append(int(chunk))
            except ValueError:
                continue
        return values

    def _parse_int(self, raw_value: str, *, default: int) -> int:
        try:
            return int(str(raw_value).strip())
        except (TypeError, ValueError):
            return default

    def _is_calendar_event_blocking(self, event: dict[str, str]) -> bool:
        transparency = self._decode_ics_text(event.get("TRANSP", "")).strip().upper()
        busy_status = self._decode_ics_text(event.get("X-MICROSOFT-CDO-BUSYSTATUS", "")).strip().upper()
        intended_status = self._decode_ics_text(event.get("X-MICROSOFT-CDO-INTENDEDSTATUS", "")).strip().upper()

        if transparency == "TRANSPARENT":
            return False
        if busy_status == "FREE":
            return False
        if intended_status == "FREE":
            return False
        return True

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


class SessionAuth:
    cookie_name = "todo_board_session"

    def __init__(
        self,
        *,
        enabled: bool,
        username: str,
        password: str,
        session_secret: str,
        session_ttl_seconds: int,
    ) -> None:
        self.enabled = bool(enabled)
        self.username = username.strip() or "admin"
        self.password = password
        self.session_ttl_seconds = max(300, int(session_ttl_seconds))
        self._secret = hashlib.sha256(session_secret.encode("utf-8")).digest()

        if self.enabled and not self.password:
            raise ValueError("TODO_PASSWORD must be set when authentication is enabled")

    @classmethod
    def from_env(cls) -> "SessionAuth":
        password = os.getenv("TODO_PASSWORD", "")
        auth_enabled_raw = os.getenv("TODO_AUTH_ENABLED")
        enabled = (
            password != ""
            if auth_enabled_raw is None
            else auth_enabled_raw.strip().lower() in {"1", "true", "yes", "on"}
        )
        username = os.getenv("TODO_USERNAME", "admin").strip() or "admin"
        secret = os.getenv("TODO_SESSION_SECRET", "") or f"{username}:{password}:task-atlas"

        try:
            ttl_hours = max(1, int(os.getenv("TODO_SESSION_TTL_HOURS", "168")))
        except ValueError:
            ttl_hours = 168

        return cls(
            enabled=enabled,
            username=username,
            password=password,
            session_secret=secret,
            session_ttl_seconds=ttl_hours * 3600,
        )

    def authenticate(self, username: str, password: str) -> bool:
        if not self.enabled:
            return True
        return (
            secrets.compare_digest(username.strip(), self.username)
            and secrets.compare_digest(password, self.password)
        )

    def issue_session_token(self) -> str:
        expires_at = int(time.time()) + self.session_ttl_seconds
        payload = f"{self.username}:{expires_at}".encode("utf-8")
        signature = hmac.new(self._secret, payload, hashlib.sha256).digest()
        encoded_signature = base64.urlsafe_b64encode(signature).decode("ascii").rstrip("=")
        return f"{expires_at}.{encoded_signature}"

    def is_valid_session_token(self, token: str) -> bool:
        if not self.enabled:
            return True

        try:
            expires_raw, supplied_signature = token.split(".", 1)
            expires_at = int(expires_raw)
        except (TypeError, ValueError):
            return False

        if expires_at <= int(time.time()):
            return False

        payload = f"{self.username}:{expires_at}".encode("utf-8")
        expected_signature = hmac.new(self._secret, payload, hashlib.sha256).digest()
        expected_encoded = base64.urlsafe_b64encode(expected_signature).decode("ascii").rstrip("=")
        return secrets.compare_digest(supplied_signature, expected_encoded)

    def build_cookie_header(self, value: str, *, secure: bool, max_age: int | None = None) -> str:
        parts = [
            f"{self.cookie_name}={value}",
            "HttpOnly",
            "Path=/",
            "SameSite=Lax",
        ]
        if max_age is not None:
            parts.append(f"Max-Age={max_age}")
        if secure:
            parts.append("Secure")
        return "; ".join(parts)


class TodoRequestHandler(SimpleHTTPRequestHandler):
    def __init__(
        self,
        *args,
        directory: str,
        store: TodoStore,
        auth: SessionAuth,
        **kwargs,
    ):
        self.store = store
        self.auth = auth
        super().__init__(*args, directory=directory, **kwargs)

    def do_GET(self) -> None:
        if self._is_health_endpoint():
            self._serve_health(include_body=True)
            return
        if self._is_session_endpoint():
            self._serve_session(include_body=True)
            return
        if self._is_login_page() and self._is_authenticated():
            self._redirect_authenticated_user()
            return
        if not self._authorize_request():
            return
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
        if self._is_health_endpoint():
            self._serve_health(include_body=False)
            return
        if self._is_session_endpoint():
            self._serve_session(include_body=False)
            return
        if not self._authorize_request():
            return
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
        if self._is_session_login_endpoint():
            payload = self._read_json_body()
            if payload is None:
                return

            username = str(payload.get("username", "")).strip()
            password = str(payload.get("password", ""))
            if not self.auth.authenticate(username, password):
                self._send_json_error(
                    HTTPStatus.UNAUTHORIZED,
                    "Invalid username or password",
                )
                return

            response_payload = {
                "ok": True,
                "authenticated": True,
                "auth_enabled": self.auth.enabled,
                "username": self.auth.username,
            }
            self._send_json(
                HTTPStatus.OK,
                response_payload,
                extra_headers={
                    "Set-Cookie": self.auth.build_cookie_header(
                        self.auth.issue_session_token(),
                        secure=self._request_is_secure(),
                        max_age=self.auth.session_ttl_seconds,
                    )
                },
            )
            return

        if self._is_session_logout_endpoint():
            self.send_response(HTTPStatus.NO_CONTENT)
            self.send_header(
                "Set-Cookie",
                self.auth.build_cookie_header(
                    "",
                    secure=self._request_is_secure(),
                    max_age=0,
                ),
            )
            self.send_header("Cache-Control", "no-store")
            self.end_headers()
            return

        if not self._authorize_request():
            return
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
        if not self._authorize_request():
            return
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

        pages = payload.get("pages")
        if pages is not None and not isinstance(pages, list):
            self.send_error(HTTPStatus.BAD_REQUEST, "Expected pages array")
            return

        settings = payload.get("settings")
        if settings is not None and not isinstance(settings, dict):
            self.send_error(HTTPStatus.BAD_REQUEST, "Expected settings object")
            return

        self.store.replace_state(tasks, teams, goals, pages, settings)
        self.send_response(HTTPStatus.NO_CONTENT)
        self.send_header("Last-Modified", self.store.last_modified())
        self.send_header("Cache-Control", "no-store")
        self.end_headers()

    def do_PATCH(self) -> None:
        if not self._authorize_request():
            return
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
        if not self._authorize_request():
            return
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
        self.send_header("Vary", "Cookie")
        super().end_headers()

    def _authorize_request(self) -> bool:
        if not self.auth.enabled:
            return True

        path = self._request_path()
        if self._is_public_path(path):
            return True

        if self._is_authenticated():
            return True

        if self._is_api_path(path):
            self._send_json_error(HTTPStatus.UNAUTHORIZED, "Authentication required")
            return False

        self._redirect_to_login()
        return False

    def _request_path(self) -> str:
        return urlparse(self.path).path

    def _is_authenticated(self) -> bool:
        if not self.auth.enabled:
            return True

        token = self._session_token_from_request()
        return self.auth.is_valid_session_token(token)

    def _session_token_from_request(self) -> str:
        cookie_header = self.headers.get("Cookie", "")
        if not cookie_header:
            return ""

        cookie = SimpleCookie()
        cookie.load(cookie_header)
        morsel = cookie.get(self.auth.cookie_name)
        return morsel.value if morsel is not None else ""

    def _request_is_secure(self) -> bool:
        forwarded_proto = self.headers.get("X-Forwarded-Proto", "").lower()
        if forwarded_proto:
            return forwarded_proto.split(",")[0].strip() == "https"

        forwarded_ssl = self.headers.get("X-Forwarded-SSL", "").lower()
        if forwarded_ssl == "on":
            return True

        forwarded = self.headers.get("Forwarded", "").lower()
        if "proto=https" in forwarded:
            return True

        return False

    def _is_public_path(self, path: str) -> bool:
        return (
            path in {
                "/favicon.ico",
                "/healthz",
                "/login.html",
                "/api/session",
                "/api/session/login",
                "/api/session/logout",
            }
            or path.startswith("/assets/")
        )

    def _is_api_path(self, path: str) -> bool:
        return path.startswith("/api/")

    def _login_redirect_target(self) -> str:
        raw_next = parse_qs(urlparse(self.path).query).get("next", ["/index.html"])[0]
        if not isinstance(raw_next, str) or not raw_next.startswith("/") or raw_next.startswith("//"):
            return "/index.html"
        return raw_next

    def _redirect_authenticated_user(self) -> None:
        self.send_response(HTTPStatus.SEE_OTHER)
        self.send_header("Location", self._login_redirect_target())
        self.send_header("Cache-Control", "no-store")
        self.end_headers()

    def _redirect_to_login(self) -> None:
        current = self._request_path()
        parsed = urlparse(self.path)
        if parsed.query:
            current = f"{current}?{parsed.query}"
        location = f"/login.html?next={quote(current, safe='/=?&')}"
        self.send_response(HTTPStatus.SEE_OTHER)
        self.send_header("Location", location)
        self.send_header("Cache-Control", "no-store")
        self.end_headers()

    def _is_state_endpoint(self) -> bool:
        return urlparse(self.path).path == "/api/state"

    def _is_tasks_collection_endpoint(self) -> bool:
        return urlparse(self.path).path == "/api/tasks"

    def _is_calendar_events_endpoint(self) -> bool:
        return urlparse(self.path).path == "/api/calendar-events"

    def _is_calendar_feed_endpoint(self) -> bool:
        return urlparse(self.path).path == "/api/calendar-feed"

    def _is_session_endpoint(self) -> bool:
        return urlparse(self.path).path == "/api/session"

    def _is_session_login_endpoint(self) -> bool:
        return urlparse(self.path).path == "/api/session/login"

    def _is_session_logout_endpoint(self) -> bool:
        return urlparse(self.path).path == "/api/session/logout"

    def _is_health_endpoint(self) -> bool:
        return urlparse(self.path).path == "/healthz"

    def _is_login_page(self) -> bool:
        return self._request_path() == "/login.html"

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

    def _send_json(
        self,
        status: HTTPStatus,
        payload: dict[str, Any] | list[dict[str, Any]],
        *,
        extra_headers: dict[str, str] | None = None,
    ) -> None:
        body = json.dumps(payload).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Last-Modified", self.store.last_modified())
        self.send_header("Cache-Control", "no-store")
        for header_name, header_value in (extra_headers or {}).items():
            self.send_header(header_name, header_value)
        self.end_headers()
        self.wfile.write(body)

    def _send_json_error(self, status: HTTPStatus, message: str) -> None:
        self._send_json(status, {"error": message})

    def _serve_health(self, *, include_body: bool) -> None:
        payload = json.dumps({"ok": True}).encode("utf-8")
        self.send_response(HTTPStatus.OK)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(payload)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()

        if include_body:
            self.wfile.write(payload)

    def _serve_session(self, *, include_body: bool) -> None:
        authenticated = self._is_authenticated()
        payload = json.dumps(
            {
                "auth_enabled": self.auth.enabled,
                "authenticated": authenticated,
                "username": self.auth.username if authenticated else "",
            }
        ).encode("utf-8")
        self.send_response(HTTPStatus.OK)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(payload)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()

        if include_body:
            self.wfile.write(payload)

    def _serve_state(self, *, include_body: bool) -> None:
        payload = json.dumps(
            {
                "tasks": self.store.fetch_tasks(),
                "teams": self.store.fetch_teams(),
                "goals": self.store.fetch_goals(),
                "pages": self.store.fetch_pages(),
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
    root_dir = Path(__file__).resolve().parent.parent
    parser = argparse.ArgumentParser(description="Serve the todo board with a SQLite-backed API.")
    parser.add_argument("--host", default=os.getenv("HOST", "0.0.0.0"))
    parser.add_argument("--port", type=int, default=int(os.getenv("PORT", "8000")))
    parser.add_argument(
        "--site-dir",
        default=os.getenv("TODO_SITE_DIR", str(root_dir / "site")),
    )
    parser.add_argument(
        "--db-file",
        default=os.getenv("TODO_DB_FILE", str(root_dir / "data" / "tasks.db")),
    )
    parser.add_argument(
        "--seed-csv",
        default=os.getenv("TODO_SEED_CSV", str(root_dir / "data" / "tasks.csv")),
    )
    parser.add_argument("--init-only", action="store_true")
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    store = TodoStore(args.db_file)
    auth = SessionAuth.from_env()
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
        auth=auth,
    )
    server = ThreadingHTTPServer((args.host, args.port), handler)
    print(f"Serving site from {args.site_dir}")
    print(f"Using database {args.db_file}")
    print(f"Listening on http://{args.host}:{args.port}")
    server.serve_forever()


if __name__ == "__main__":
    main()
