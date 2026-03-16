# Todo Board API

The local server serves the static app from `site/` and exposes a small JSON API.

## Start the server

```bash
bash scripts/start-todo.sh 8000
```

Default port is `80` if you omit the argument.

On first start, if `data/tasks.csv` exists and `data/tasks.db` is empty or missing, the server imports the CSV into SQLite and deletes `data/tasks.csv`.

## Base URL

Examples below assume:

```text
http://127.0.0.1:8000
```

## Data model

Each task has:

```json
{
  "id": 1,
  "name": "Schedule 1-1s / Stakeholder",
  "status": "Done",
  "team": "BUH",
  "mode": "Run",
  "owner": "Me",
  "priority": "Must",
  "time_estimate": "30m",
  "goal": "Stabilize the BU operating cadence",
  "deadline": "2026-03-13",
  "scheduled_date": "2026-03-16",
  "scheduled_hour": "09:00",
  "created_at": "2026-03-10",
  "completed_at": "2026-03-16",
  "notes": "Kevin macht das"
}
```

Field notes:

- `id`: integer primary key
- `name`: required string
- `status`: string, usually `Not started`, `In development`, or `Done`
- `team`: string, may be empty; the UI treats this as the task's area/group
- `mode`: `Run`, `Change`, or empty
- `owner`: `Me`, `Delegate`, or empty
- `priority`: `Must`, `Should`, `Could`, `Needs refinement`, or empty
- `time_estimate`: one of `<5m`, `15m`, `30m`, `1h`, `2h+`, or empty; the UI labels this as effort
- `goal`: string label selected from the persisted `goals` list, may be empty
- `deadline`: ISO date string `YYYY-MM-DD` or empty
- `scheduled_date`: ISO date string `YYYY-MM-DD` or empty; used by the local Focus Week planner
- `scheduled_hour`: one of `08:00` through `17:00`, or empty
- `created_at`: ISO date string `YYYY-MM-DD`
- `completed_at`: ISO date string `YYYY-MM-DD` or empty; set when a task is marked `Done`
- `notes`: free text string

## Endpoints

### `GET /api/state`

Returns the current ordered task list, area order, and goal list.

Example:

```bash
curl http://127.0.0.1:8000/api/state
```

Response:

```json
{
  "teams": ["BUH", "Sales", "Product"],
  "goals": ["Stabilize the BU operating cadence", "Create a usable Q2 operating plan"],
  "tasks": [
    {
      "id": 1,
      "name": "Schedule 1-1s / Stakeholder",
      "status": "Done",
      "team": "BUH",
      "mode": "Run",
      "owner": "Me",
      "priority": "Must",
      "time_estimate": "",
      "goal": "",
      "deadline": "",
      "created_at": "2026-03-10",
      "completed_at": "2026-03-16",
      "notes": ""
    }
  ]
}
```

Response headers:

- `Content-Type: application/json; charset=utf-8`
- `Last-Modified: ...`
- `Cache-Control: no-store`

### `HEAD /api/state`

Returns the same headers as `GET /api/state` without the body. The frontend uses this to detect external changes.

Example:

```bash
curl -I http://127.0.0.1:8000/api/state
```

### `PUT /api/state`

Replaces the entire task list in SQLite with the provided ordered array.

Example:

```bash
curl -X PUT http://127.0.0.1:8000/api/state \
  -H 'Content-Type: application/json' \
  --data-binary '{
    "tasks": [
      {
        "id": 1,
        "name": "Schedule 1-1s / Stakeholder",
        "status": "Done",
        "team": "BUH",
        "mode": "Run",
        "owner": "Me",
        "time_estimate": "",
        "goal": "",
        "deadline": "",
        "created_at": "2026-03-10",
        "completed_at": "2026-03-16",
        "notes": ""
      }
    ]
  }'
```

Behavior:

- the submitted array order becomes the persisted order
- the submitted `teams` array becomes the persisted team-group order
- the submitted `goals` array becomes the persisted goal list/order
- rows with empty `name` are ignored
- duplicate or missing ids are normalized by the server

Response:

- status `204 No Content`
- updated `Last-Modified` header

### `GET /api/tasks`

Returns the current task list.

Example:

```bash
curl http://127.0.0.1:8000/api/tasks
```

Response:

```json
{
  "tasks": [
    {
      "id": 1,
      "name": "Schedule 1-1s / Stakeholder",
      "status": "Done",
      "team": "BUH",
      "mode": "Run",
      "owner": "Me",
      "priority": "Must",
      "time_estimate": "",
      "goal": "",
      "deadline": "",
      "created_at": "2026-03-10",
      "completed_at": "2026-03-16",
      "notes": ""
    }
  ]
}
```

Optional query:

- `completed_at=YYYY-MM-DD` filters to tasks completed on that date

Example:

```bash
curl 'http://127.0.0.1:8000/api/tasks?completed_at=2026-03-16'
```

### `POST /api/tasks`

Creates one task and appends it to the end of the stored order.

Example:

```bash
curl -X POST http://127.0.0.1:8000/api/tasks \
  -H 'Content-Type: application/json' \
  --data-binary '{
    "name": "Prepare Q2 planning",
    "status": "Not started",
    "team": "Product",
    "mode": "Change",
    "owner": "Me",
    "priority": "Should",
    "time_estimate": "1h",
    "goal": "Create a usable Q2 operating plan",
    "deadline": "2026-03-20",
    "created_at": "2026-03-15",
    "completed_at": "",
    "notes": ""
  }'
```

### `GET /api/tasks/:id`

Returns a single task by id.

Example:

```bash
curl http://127.0.0.1:8000/api/tasks/84
```

### `PATCH /api/tasks/:id`

Updates one task in place.

Example:

```bash
curl -X PATCH http://127.0.0.1:8000/api/tasks/84 \
  -H 'Content-Type: application/json' \
  --data-binary '{
    "status": "Done",
    "owner": "Delegate",
    "notes": "Handed over and confirmed"
  }'
```

When a task transitions to `Done`, the server stores `completed_at` automatically if you do not provide one explicitly.

### `DELETE /api/tasks/:id`

Deletes one task by id.

Example:

```bash
curl -X DELETE http://127.0.0.1:8000/api/tasks/84
```

Response:

- status `204 No Content`

## Persistence

- Source of truth: `data/tasks.db`
- One-time seed source: `data/tasks.csv`
- Static UI: `site/`

## Notes for Agents

- If you need full-list replacement or reordering, use `GET /api/state` and `PUT /api/state`.
- Goals are managed through the `goals` array on `/api/state`; task `goal` values should match one of those names.
- If you need single-task CRUD, use `/api/tasks` and `/api/tasks/:id`.
- If you need "what was finished on a specific day?", use `GET /api/tasks?completed_at=YYYY-MM-DD`.
- If you edit `data/tasks.db` directly, the browser will pick up changes on the next polling cycle.
