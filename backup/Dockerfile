# syntax=docker/dockerfile:1
# The nightly backup: pg_dump of the database and a copy of the media bucket,
# both into one restic snapshot, then the retention and a heartbeat ping.
FROM debian:trixie-slim

ARG SUPERCRONIC_VERSION=0.2.51
ARG SUPERCRONIC_SHA256_AMD64=cc232108374e8e2b537045f2d5eaa1229f619db314c3ba6a14d38b35dc0aa123
ARG SUPERCRONIC_SHA256_ARM64=4ae22576a78223d8ccdf5f3b3660a5cbb5288416bf0ca96afc4a36d195932b94
ARG TARGETARCH

RUN apt-get update \
    && apt-get install -y --no-install-recommends \
       ca-certificates curl postgresql-client-17 restic rclone \
    && rm -rf /var/lib/apt/lists/*
RUN set -eux; \
    case "${TARGETARCH:-amd64}" in \
      amd64) sha="${SUPERCRONIC_SHA256_AMD64}" ;; \
      arm64) sha="${SUPERCRONIC_SHA256_ARM64}" ;; \
      *) exit 1 ;; \
    esac; \
    file="supercronic-linux-${TARGETARCH:-amd64}"; \
    curl -fsSL -o "/tmp/${file}" \
      "https://github.com/aptible/supercronic/releases/download/v${SUPERCRONIC_VERSION}/${file}"; \
    echo "${sha}  /tmp/${file}" | sha256sum -c -; \
    install -m 0755 "/tmp/${file}" /usr/local/bin/supercronic

COPY backup/backup.sh backup/restore.sh backup/counts.sql backup/crontab /opt/backup/
RUN chmod +x /opt/backup/*.sh && supercronic -test /opt/backup/crontab
WORKDIR /opt/backup
