#!/bin/bash
# Starts the local todo server.
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
SITE_DIR="$(cd "$SCRIPT_DIR/../site" && pwd)"
DATA_DIR="$(cd "$SCRIPT_DIR/../data" && pwd)"
DB_FILE="${TODO_DB_FILE:-$DATA_DIR/tasks.db}"
SEED_CSV="${TODO_SEED_CSV:-$DATA_DIR/tasks.csv}"
PORT="${PORT:-80}"

while [ "$#" -gt 0 ]; do
  case "$1" in
    --port)
      if [ -z "$2" ]; then
        echo "Missing value for --port" >&2
        exit 1
      fi
      PORT="$2"
      shift 2
      ;;
    -p)
      if [ -z "$2" ]; then
        echo "Missing value for -p" >&2
        exit 1
      fi
      PORT="$2"
      shift 2
      ;;
    --help|-h)
      echo "Usage: $0 [PORT] [--port PORT] [-p PORT]"
      exit 0
      ;;
    *)
      if [ "$PORT" = "80" ]; then
        PORT="$1"
        shift
      else
        echo "Unexpected argument: $1" >&2
        echo "Usage: $0 [PORT] [--port PORT] [-p PORT]" >&2
        exit 1
      fi
      ;;
  esac
done

if [ ! -d "$SITE_DIR" ]; then
  echo "Site directory not found: $SITE_DIR" >&2
  exit 1
fi

echo ""
echo "  ✓ todo server running on port $PORT"
echo "  ✓ Serving files from: $SITE_DIR"
echo "  ✓ Using database: $DB_FILE"
if [ -f "$SEED_CSV" ]; then
  echo "  ✓ Seed CSV will be imported once: $SEED_CSV"
fi
echo "  Press Ctrl+C to stop."
echo ""

if [ "$PORT" -lt 1024 ]; then
  sudo python3 "$SCRIPT_DIR/todo_server.py" --site-dir "${TODO_SITE_DIR:-$SITE_DIR}" --db-file "$DB_FILE" --seed-csv "$SEED_CSV" --port "$PORT"
else
  python3 "$SCRIPT_DIR/todo_server.py" --site-dir "${TODO_SITE_DIR:-$SITE_DIR}" --db-file "$DB_FILE" --seed-csv "$SEED_CSV" --port "$PORT"
fi
