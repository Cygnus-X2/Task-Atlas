FROM python:3.13-slim

WORKDIR /app

ENV PYTHONUNBUFFERED=1

COPY README.md ./README.md
COPY data ./data
COPY docs ./docs
COPY scripts ./scripts
COPY site ./site

EXPOSE 8000

CMD ["sh", "-c", "python3 scripts/todo_server.py --host 0.0.0.0 --port ${PORT:-8000} --site-dir ${TODO_SITE_DIR:-/app/site} --db-file ${TODO_DB_FILE:-/app/data/tasks.db} --seed-csv ${TODO_SEED_CSV:-/app/data/tasks.csv}"]
