#!/usr/bin/env python3

from __future__ import annotations

import argparse
import csv
import functools
import json
import sqlite3
from datetime import datetime
from email.utils import formatdate
from http import HTTPStatus
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from typing import Any
from urllib.parse import urlparse

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
    urgency TEXT NOT NULL DEFAULT '',
    importance TEXT NOT NULL DEFAULT '',
    time_estimate TEXT NOT NULL DEFAULT '',
    deadline TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL DEFAULT '',
    notes TEXT NOT NULL DEFAULT ''
);

CREATE TABLE IF NOT EXISTS teams (
    name TEXT PRIMARY KEY,
    position INTEGER NOT NULL
);
"""


class TodoStore:
    def __init__(self, db_file: str):
        self.db_file = Path(db_file)
        self.db_file.parent.mkdir(parents=True, exist_ok=True)
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
            if "importance" not in task_columns:
                connection.execute(
                    "ALTER TABLE tasks ADD COLUMN importance TEXT NOT NULL DEFAULT ''"
                )
            if "time_estimate" not in task_columns:
                connection.execute(
                    "ALTER TABLE tasks ADD COLUMN time_estimate TEXT NOT NULL DEFAULT ''"
                )
            if "created_at" not in task_columns:
                connection.execute(
                    "ALTER TABLE tasks ADD COLUMN created_at TEXT NOT NULL DEFAULT ''"
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

            team_count = connection.execute("SELECT COUNT(*) FROM teams").fetchone()[0]
            if not team_count:
                team_names = self._derive_team_names(connection)
                connection.executemany(
                    "INSERT INTO teams (name, position) VALUES (?, ?)",
                    [(team, position) for position, team in enumerate(team_names)],
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

    def fetch_tasks(self) -> list[dict[str, Any]]:
        with self._connect() as connection:
            rows = connection.execute(
                """
                SELECT id, name, status, team, urgency, importance, time_estimate, deadline, created_at, notes
                FROM tasks
                ORDER BY position ASC, id ASC
                """
            ).fetchall()

        return [dict(row) for row in rows]

    def fetch_task(self, task_id: int) -> dict[str, Any] | None:
        with self._connect() as connection:
            row = connection.execute(
                """
                SELECT id, name, status, team, urgency, importance, time_estimate, deadline, created_at, notes
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
                    str(task.get("team", "")).strip(),
                    self._normalize_urgency(task.get("urgency", "")),
                    self._normalize_importance(task.get("importance", ""), task.get("prio", "")),
                    self._normalize_time_estimate(task.get("time_estimate", "")),
                    str(task.get("deadline", "")).strip(),
                    self._normalize_created_at(task.get("created_at", ""), task_id),
                    str(task.get("notes", "")).strip(),
                )
            )

        team_names = self._normalize_team_names(None, tasks)

        with self._connect() as connection:
            connection.execute("BEGIN")
            connection.execute("DELETE FROM tasks")
            connection.executemany(
                """
                INSERT INTO tasks (id, position, name, status, team, urgency, importance, time_estimate, deadline, created_at, notes)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                [row for row in normalized if row[2]],
            )
            self._replace_teams(connection, team_names)
            connection.commit()

    def replace_state(
        self,
        tasks: list[dict[str, Any]],
        teams: list[str] | None = None,
    ) -> None:
        normalized = []
        used_ids: set[int] = set()
        next_generated_id = 1

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
                    str(task.get("team", "")).strip(),
                    self._normalize_urgency(task.get("urgency", "")),
                    self._normalize_importance(task.get("importance", ""), task.get("prio", "")),
                    self._normalize_time_estimate(task.get("time_estimate", "")),
                    str(task.get("deadline", "")).strip(),
                    self._normalize_created_at(task.get("created_at", ""), task_id),
                    str(task.get("notes", "")).strip(),
                )
            )

        team_names = self._normalize_team_names(teams, tasks)

        with self._connect() as connection:
            connection.execute("BEGIN")
            connection.execute("DELETE FROM tasks")
            connection.executemany(
                """
                INSERT INTO tasks (id, position, name, status, team, urgency, importance, time_estimate, deadline, created_at, notes)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                [row for row in normalized if row[2]],
            )
            self._replace_teams(connection, team_names)
            connection.commit()

    def create_task(self, task: dict[str, Any]) -> dict[str, Any]:
        normalized = self._normalize_task_payload(task, require_name=True)

        with self._connect() as connection:
            position = connection.execute(
                "SELECT COALESCE(MAX(position), -1) + 1 FROM tasks"
            ).fetchone()[0]
            cursor = connection.execute(
                """
                INSERT INTO tasks (position, name, status, team, urgency, importance, time_estimate, deadline, created_at, notes)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    position,
                    normalized["name"],
                    normalized["status"],
                    normalized["team"],
                    normalized["urgency"],
                    normalized["importance"],
                    normalized["time_estimate"],
                    normalized["deadline"],
                    normalized["created_at"],
                    normalized["notes"],
                ),
            )
            if normalized["team"]:
                self._ensure_team(connection, normalized["team"])
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
        normalized = self._normalize_task_payload(merged, require_name=True)

        with self._connect() as connection:
            connection.execute(
                """
                UPDATE tasks
                SET name = ?, status = ?, team = ?, urgency = ?, importance = ?, time_estimate = ?, deadline = ?, created_at = ?, notes = ?
                WHERE id = ?
                """,
                (
                    normalized["name"],
                    normalized["status"],
                    normalized["team"],
                    normalized["urgency"],
                    normalized["importance"],
                    normalized["time_estimate"],
                    normalized["deadline"],
                    normalized["created_at"],
                    normalized["notes"],
                    task_id,
                ),
            )
            if normalized["team"]:
                self._ensure_team(connection, normalized["team"])
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
    ) -> dict[str, str]:
        name = str(task.get("name", "")).strip()
        if require_name and not name:
            raise ValueError("Task name is required")

        return {
            "name": name,
            "status": str(task.get("status", "Not started")).strip() or "Not started",
            "team": str(task.get("team", "")).strip(),
            "urgency": self._normalize_urgency(task.get("urgency", "")),
            "importance": self._normalize_importance(task.get("importance", ""), task.get("prio", "")),
            "time_estimate": self._normalize_time_estimate(task.get("time_estimate", "")),
            "deadline": str(task.get("deadline", "")).strip(),
            "created_at": self._normalize_created_at(
                task.get("created_at", ""),
                task.get("id"),
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

    def _replace_teams(self, connection: sqlite3.Connection, team_names: list[str]) -> None:
        connection.execute("DELETE FROM teams")
        connection.executemany(
            "INSERT INTO teams (name, position) VALUES (?, ?)",
            [(team, position) for position, team in enumerate(team_names)],
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

    def _normalize_urgency(self, value: Any) -> str:
        raw = str(value or "").strip().lower()
        if raw in {"yes", "true", "1", "urgent"}:
            return "yes"
        if raw in {"no", "false", "0", "not urgent", "later"}:
            return "no"
        return ""

    def _normalize_importance(self, value: Any, legacy_prio: Any = "") -> str:
        raw = str(value or "").strip().lower()
        if raw in {"yes", "true", "1", "important"}:
            return "yes"
        if raw in {"no", "false", "0", "not important"}:
            return "no"

        legacy = str(legacy_prio or "").strip().lower()
        if legacy in {"high", "medium"}:
            return "yes"
        if legacy == "low":
            return "no"
        return ""

    def _normalize_time_estimate(self, value: Any) -> str:
        raw = str(value or "").strip()
        allowed = {"<5m", "15m", "30m", "1h", "2h+"}
        return raw if raw in allowed else ""

    def _normalize_created_at(self, value: Any, task_id: Any = None) -> str:
        raw = str(value or "").strip()
        if len(raw) >= 10:
            candidate = raw[:10]
            try:
                datetime.strptime(candidate, "%Y-%m-%d")
                return candidate
            except ValueError:
                pass
        return self._infer_created_at(task_id)

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

        self.store.replace_state(tasks, teams)
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
        payload = json.dumps({"tasks": self.store.fetch_tasks()}).encode("utf-8")
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
                "team": (row.get("Team") or row.get("team") or "").strip(),
                "urgency": (row.get("Urgent") or row.get("urgency") or "").strip(),
                "importance": (row.get("Important") or row.get("importance") or "").strip(),
                "time_estimate": (
                    row.get("Time")
                    or row.get("Time Estimate")
                    or row.get("time_estimate")
                    or row.get("estimate")
                    or ""
                ).strip(),
                "prio": (row.get("Priority") or row.get("Prio") or row.get("prio") or "").strip(),
                "deadline": (row.get("Deadline") or row.get("deadline") or "").strip(),
                "created_at": (row.get("Created") or row.get("created_at") or "").strip(),
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
