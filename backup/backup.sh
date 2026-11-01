#!/bin/sh
# One restic snapshot with the database dump and the media bucket's files.
#
# Environment (from .env.backup): RESTIC_REPOSITORY, RESTIC_PASSWORD and the
# repository's own keys; MEDIA_S3_ENDPOINT, MEDIA_S3_BUCKET,
# MEDIA_S3_ACCESS_KEY_ID, MEDIA_S3_SECRET_ACCESS_KEY (read-only keys);
# HEARTBEAT_URL (optional, pinged on success). PG* and DUMP_RESTIC_HOST come
# from compose.prod.yml.
set -eu
work="$(mktemp -d)"
trap 'rm -rf "$work"' EXIT
mkdir -p "$work/db" "$work/media"

pg_dump --format=custom --no-owner --file="$work/db/pets.dump"
psql -At -c "select 'animals', count(*) from animals_animal union all select 'vaccines', count(*) from animals_vaccine union all select 'attachments', count(*) from animals_attachment" \
  > "$work/db/row-counts.txt"

export RCLONE_CONFIG_MEDIA_TYPE=s3
export RCLONE_CONFIG_MEDIA_PROVIDER=Other
export RCLONE_CONFIG_MEDIA_ENDPOINT="${MEDIA_S3_ENDPOINT:?}"
export RCLONE_CONFIG_MEDIA_ACCESS_KEY_ID="${MEDIA_S3_ACCESS_KEY_ID:?}"
export RCLONE_CONFIG_MEDIA_SECRET_ACCESS_KEY="${MEDIA_S3_SECRET_ACCESS_KEY:?}"
rclone copy "media:${MEDIA_S3_BUCKET:?}" "$work/media" --fast-list
find "$work/media" -type f | sort > "$work/db/media-manifest.txt"

restic snapshots >/dev/null 2>&1 || restic init
cd "$work"
restic backup --host "${DUMP_RESTIC_HOST:?}" --tag nightly db media
restic forget --host "${DUMP_RESTIC_HOST}" --keep-daily 30 --keep-monthly 12 --prune

if [ -n "${HEARTBEAT_URL:-}" ]; then curl -fsS --retry 3 "$HEARTBEAT_URL" >/dev/null; fi
echo "backup done"
