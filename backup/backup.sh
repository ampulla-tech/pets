#!/bin/sh
# One restic snapshot with the database dump and the media bucket's files.
#
# Environment:
# - from compose.prod.yml: RESTIC_REPOSITORY, MEDIA_S3_ENDPOINT,
#   MEDIA_S3_PROVIDER (rclone's S3 provider, Cloudflare for R2),
#   MEDIA_S3_BUCKET, PG* and DUMP_RESTIC_HOST;
# - from .env.backup: RESTIC_PASSWORD, RESTIC_AWS_ACCESS_KEY_ID and
#   RESTIC_AWS_SECRET_ACCESS_KEY (the repository's read-write keys, handed to
#   restic only), MEDIA_S3_ACCESS_KEY_ID and MEDIA_S3_SECRET_ACCESS_KEY (the
#   media bucket's read-only keys, handed to rclone only), BACKUP_PING_URL
#   (optional, pinged on success).
#
# The repository must already exist (first-run.sh creates it, from the
# deploy), so a wrong RESTIC_REPOSITORY fails here instead of silently
# starting a new, empty repository somewhere else.
set -eu
work="$(mktemp -d)"
trap 'rm -rf "$work"' EXIT
mkdir -p "$work/db" "$work/media"

# The dump and the row counts read the same snapshot of the database: one psql
# session opens a REPEATABLE READ transaction, exports its snapshot and counts
# inside it, and pg_dump reads that exported snapshot while the session is held
# open. restore.sh compares the restored database with these counts, so a row
# written during the backup cannot make them disagree.
mkfifo "$work/psql.in"
psql -X -q -At -F ' ' -v ON_ERROR_STOP=1 <"$work/psql.in" >"$work/psql.out" &
psql_pid=$!
exec 3>"$work/psql.in"
printf 'BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY;\nSELECT pg_export_snapshot();\n' >&3
pg_snapshot=""
for _ in $(seq 1 100); do
  pg_snapshot="$(head -n 1 "$work/psql.out")"
  [ -z "$pg_snapshot" ] || break
  kill -0 "$psql_pid" 2>/dev/null || break
  sleep 0.1
done
[ -n "$pg_snapshot" ] || { echo "backup: no exported snapshot from psql" >&2; exit 1; }
printf '\\o %s\n\\i /opt/backup/counts.sql\n\\o\n' "$work/db/row-counts.txt" >&3
pg_dump --format=custom --no-owner --snapshot="$pg_snapshot" --file="$work/db/pets.dump"
printf 'COMMIT;\n' >&3
exec 3>&-
wait "$psql_pid"
[ -s "$work/db/row-counts.txt" ] || { echo "backup: no row counts" >&2; exit 1; }

export RCLONE_CONFIG_MEDIA_TYPE=s3
export RCLONE_CONFIG_MEDIA_PROVIDER="${MEDIA_S3_PROVIDER:-Cloudflare}"
export RCLONE_CONFIG_MEDIA_ENDPOINT="${MEDIA_S3_ENDPOINT:?}"
export RCLONE_CONFIG_MEDIA_ACCESS_KEY_ID="${MEDIA_S3_ACCESS_KEY_ID:?}"
export RCLONE_CONFIG_MEDIA_SECRET_ACCESS_KEY="${MEDIA_S3_SECRET_ACCESS_KEY:?}"
rclone copy "media:${MEDIA_S3_BUCKET:?}" "$work/media" --fast-list
(cd "$work/media" && find . -type f | sort) > "$work/db/media-manifest.txt"

: "${RESTIC_REPOSITORY:?}" "${RESTIC_PASSWORD:?}"
cd "$work"
AWS_ACCESS_KEY_ID="${RESTIC_AWS_ACCESS_KEY_ID:?}" \
  AWS_SECRET_ACCESS_KEY="${RESTIC_AWS_SECRET_ACCESS_KEY:?}" \
  restic backup --host "${DUMP_RESTIC_HOST:?}" --tag nightly db media
# Grouped by host and tags, not by path: each night backs up from a new
# scratch directory, so grouping by path would keep every snapshot forever.
AWS_ACCESS_KEY_ID="$RESTIC_AWS_ACCESS_KEY_ID" \
  AWS_SECRET_ACCESS_KEY="$RESTIC_AWS_SECRET_ACCESS_KEY" \
  restic forget --host "$DUMP_RESTIC_HOST" --group-by host,tags \
  --keep-daily 30 --keep-monthly 12 --prune

if [ -n "${BACKUP_PING_URL:-}" ]; then curl -fsS --retry 3 "$BACKUP_PING_URL" >/dev/null; fi
echo "backup done"
