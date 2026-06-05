# ─────────────────────────────────────────
# Stage 1: builder
# ─────────────────────────────────────────
FROM python:3.12-slim AS builder

WORKDIR /build

RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    libpq-dev \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --upgrade pip && \
    pip wheel --no-cache-dir --no-deps --wheel-dir /build/wheels -r requirements.txt

# ─────────────────────────────────────────
# Stage 2: production
# ─────────────────────────────────────────
FROM python:3.12-slim AS production

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PYTHONPATH=/app \
    PROMETHEUS_MULTIPROC_DIR=/tmp/prometheus_multiproc

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    libpq5 \
    curl \
    && rm -rf /var/lib/apt/lists/*

COPY --from=builder /build/wheels /wheels
RUN pip install --no-cache /wheels/*

RUN groupadd -r appuser && useradd -r -g appuser appuser

COPY --chown=appuser:appuser . .

RUN mkdir -p /tmp/prometheus_multiproc && \
    chown -R appuser:appuser /tmp/prometheus_multiproc

USER appuser

EXPOSE 8000

# Wait for DB, run migrations, then start server
CMD ["sh", "-c", "python wait_for_db.py && alembic upgrade head && uvicorn app.main:app --host 0.0.0.0 --port 8000 --workers ${BACKEND_WORKERS:-4} --loop uvloop --http httptools --access-log --log-level info"]
