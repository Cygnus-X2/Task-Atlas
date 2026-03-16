# Todo Board

Small local task board with:

- a static frontend in `site/`
- a local Python server in `scripts/`
- a SQLite database in `data/tasks.db`

The frontend edits tasks through a local API instead of storing data in the browser.

## Run

Start on a non-privileged port:

```bash
bash scripts/start-todo.sh 8000
```

Then open:

```text
http://127.0.0.1:8000
```

If you omit the port, the script defaults to `80`.

## Restart The Service

If you are using the root `launchd` daemon on port `80`, restart it with:

```bash
sudo launchctl unload -w /Library/LaunchDaemons/com.nik.todo-board.server.root.plist
sudo launchctl load -w /Library/LaunchDaemons/com.nik.todo-board.server.root.plist
```

Verify it after restart:

```bash
sudo launchctl print system/com.nik.todo-board.server.root
curl -I http://todo.nik
```

Practical rule:

- if you changed files in `site/` only, usually just refresh the browser
- if you changed `scripts/todo_server.py`, `scripts/start-todo.sh`, or the daemon plist, restart the daemon

## Start At Login

For macOS, the simplest setup is:

1. map `todo.nik` to localhost once
2. run the server with `launchd`
3. optionally open the browser automatically at login

Add this once to `/etc/hosts`:

```bash
echo '127.0.0.1 todo.nik' | sudo tee -a /etc/hosts
```

### Easiest setup

Use port `8000` and open `http://todo.nik:8000`.

Install these user agents:

```bash
cp launchd/com.nik.todo-board.server.user.plist ~/Library/LaunchAgents/
cp launchd/com.nik.todo-board.open-browser.plist ~/Library/LaunchAgents/
launchctl load -w ~/Library/LaunchAgents/com.nik.todo-board.server.user.plist
launchctl load -w ~/Library/LaunchAgents/com.nik.todo-board.open-browser.plist
```

This will:

- start the server at login
- keep it running
- open the browser to `http://todo.nik:8000`

### Clean `todo.nik` without a port

If you want exactly `http://todo.nik`, the server must run on port `80`.
Because port `80` is privileged on macOS, use a root daemon instead of a user agent:

```bash
sudo cp launchd/com.nik.todo-board.server.root.plist /Library/LaunchDaemons/
sudo launchctl load -w /Library/LaunchDaemons/com.nik.todo-board.server.root.plist
```

Then you can open:

```text
http://todo.nik
```

If you also want the browser to open automatically at login, still install:

```bash
cp launchd/com.nik.todo-board.open-browser.plist ~/Library/LaunchAgents/
launchctl load -w ~/Library/LaunchAgents/com.nik.todo-board.open-browser.plist
```

If you use the root daemon on port `80`, change the URL inside `launchd/com.nik.todo-board.open-browser.plist` from `http://todo.nik:8000` to `http://todo.nik`.

## Data Storage

Canonical data lives in:

```text
data/tasks.db
```

On first start, the server can import:

```text
data/tasks.csv
```

into SQLite once, then delete the CSV seed file.

Current behavior:

- source of truth: `data/tasks.db`
- browser talks to `/api/state`
- CSV is only for initial seed or manual import/export
- the board model now emphasizes `team` as area, plus `mode`, `owner`, `time_estimate`, and goal objects managed through `/api/state`
- tasks also carry a commitment-style `priority` field with written-out values: `Must`, `Should`, `Could`, and `Needs refinement`
- tasks still carry a read-only `created_at` date for API/export/history purposes even though it is no longer shown as a main board column
- when a task is marked `Done`, the server stores `completed_at` so you can query what was finished on a given day

## API

API documentation is in:

[`docs/api.md`](/Users/nik/projects/todo-board/docs/api.md)

Current main endpoint:

- `GET /api/state`
- `HEAD /api/state`
- `PUT /api/state`
- `GET /api/tasks`
- `GET /api/tasks?completed_at=YYYY-MM-DD`
- `POST /api/tasks`
- `GET /api/tasks/:id`
- `PATCH /api/tasks/:id`
- `DELETE /api/tasks/:id`

## Project Layout

```text
site/         static app
site/assets/  frontend CSS + JS
scripts/      local server and launcher
data/         SQLite database and optional one-time seed CSV
docs/         project documentation
uploads/      imported source files
```

## Frontend

Main files:

- [`site/index.html`](/Users/nik/projects/todo-board/site/index.html)
- [`site/goals.html`](/Users/nik/projects/todo-board/site/goals.html)
- [`site/focus-week.html`](/Users/nik/projects/todo-board/site/focus-week.html)
- [`site/niklas-board.html`](/Users/nik/projects/todo-board/site/niklas-board.html)
- [`site/assets/css/app.css`](/Users/nik/projects/todo-board/site/assets/css/app.css)
- [`site/assets/js/app.js`](/Users/nik/projects/todo-board/site/assets/js/app.js)

## Server

Main files:

- [`scripts/start-todo.sh`](/Users/nik/projects/todo-board/scripts/start-todo.sh)
- [`scripts/todo_server.py`](/Users/nik/projects/todo-board/scripts/todo_server.py)

## Agent / Script Workflow

If another agent or script needs to modify tasks, prefer the API:

For single-task changes:

1. `POST /api/tasks`
2. `PATCH /api/tasks/:id`
3. `DELETE /api/tasks/:id`

For full reorder or full replacement:

1. `GET /api/state`
2. modify the `tasks` array
3. `PUT /api/state`

That avoids direct browser coupling and keeps the app in sync.

Team group order is persisted separately from task order. Dragging team headers updates the stored `teams` order in `/api/state`, so sequences like `BUH`, `Sales`, `Product` survive reloads and empty-team cases.

## Notes

If `data/tasks.csv` was created by `sudo` or another privileged process, the first import may fail due to file permissions. In that case, fix ownership first, then rerun the server.
