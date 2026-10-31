# syntax=docker/dockerfile:1
#
# Built from the repo root as context, as CI and the compose stack build it:
#
#   docker build -f backend/Dockerfile .

FROM ghcr.io/astral-sh/uv:latest AS uv

# supercronic runs the crontab in the `cron` service: the upstream static
# release, pinned by version and by the SHA256 of each binary.
FROM debian:trixie-slim AS supercronic

ARG SUPERCRONIC_VERSION=0.2.51
ARG SUPERCRONIC_SHA256_AMD64=cc232108374e8e2b537045f2d5eaa1229f619db314c3ba6a14d38b35dc0aa123
ARG SUPERCRONIC_SHA256_ARM64=4ae22576a78223d8ccdf5f3b3660a5cbb5288416bf0ca96afc4a36d195932b94
ARG TARGETARCH

RUN apt-get update \
    && apt-get install -y --no-install-recommends ca-certificates curl \
    && rm -rf /var/lib/apt/lists/*
RUN set -eux; \
    case "${TARGETARCH:-amd64}" in \
      amd64) sha="${SUPERCRONIC_SHA256_AMD64}" ;; \
      arm64) sha="${SUPERCRONIC_SHA256_ARM64}" ;; \
      *) echo "no pinned supercronic for architecture: ${TARGETARCH}" >&2; exit 1 ;; \
    esac; \
    file="supercronic-linux-${TARGETARCH:-amd64}"; \
    curl -fsSL -o "/tmp/${file}" \
      "https://github.com/aptible/supercronic/releases/download/v${SUPERCRONIC_VERSION}/${file}"; \
    echo "${sha}  /tmp/${file}" | sha256sum -c -; \
    install -m 0755 "/tmp/${file}" /usr/local/bin/supercronic

# --- base: interpreter + prod dependencies + code -----------------------------
FROM python:3.13-slim AS base

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    UV_COMPILE_BYTECODE=1 \
    UV_LINK_MODE=copy \
    PATH="/app/.venv/bin:$PATH"

COPY --from=uv /uv /usr/local/bin/uv

WORKDIR /app

COPY backend/pyproject.toml backend/uv.lock ./
RUN uv sync --frozen --no-dev --no-install-project

COPY backend/ .

# --- dev: dev dependencies + the autoreloading dev server ---------------------
FROM base AS dev
RUN uv sync --frozen --no-install-project
EXPOSE 8000
CMD ["python", "manage.py", "runserver", "0.0.0.0:8000"]

# --- prod: static assets, non-root, granian (the default target) --------------
FROM base AS prod

RUN DJANGO_DEBUG=False python manage.py collectstatic --noinput

COPY --from=supercronic /usr/local/bin/supercronic /usr/local/bin/supercronic
RUN supercronic -test /app/crontab

RUN useradd --create-home --uid 10001 appuser \
    && mkdir -p /app/uploads \
    && chown -R appuser:appuser /app
USER appuser

EXPOSE 8000

# granian serves the ASGI app; `asginl` is ASGI without the lifespan protocol,
# which Django does not implement.
CMD ["granian", "--interface", "asginl", "--workers", "2", "--host", "0.0.0.0", "--port", "8000", "config.asgi:application"]
