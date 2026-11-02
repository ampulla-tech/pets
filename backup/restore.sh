#!/bin/sh
# Restore one snapshot: the database into a new database of the given name, the
# media files into a scratch directory, and check both against what the
# snapshot recorded when it was taken.
#
#   restore.sh <snapshot-id|latest> <target-database>
#
# Runs in the backup container, with its environment (RESTIC_*, PG*). It
# refuses a target database that already holds tables, so it never writes over
# the live database or over an earlier restore. It prints one line per check:
#
#   database <target>: <n> tables, counts match
#   media: <n> files under <dir>, manifest matches
#
# and exits non-zero on any difference. Putting the media back in the bucket
# and promoting the restored database are steps of the runbook, by hand.
set -eu
snapshot="${1:?usage: restore.sh <snapshot-id|latest> <target-database>}"
target="${2:?usage: restore.sh <snapshot-id|latest> <target-database>}"
case "$target" in
*[!a-z0-9_]* | "") echo "restore: the target database name must be [a-z0-9_]" >&2 && exit 2 ;;
esac

die() {
  echo "restore: FAIL: $*" >&2
  exit 1
}

exists="$(psql -At -d postgres -c "SELECT 1 FROM pg_database WHERE datname = '$target'")"
if [ "$exists" = 1 ]; then
  tables="$(psql -At -d "$target" -c "SELECT count(*) FROM information_schema.tables WHERE table_schema = 'public'")"
  [ "$tables" = 0 ] || die "database $target already holds data ($tables tables); pick another name"
else
  createdb "$target"
fi

out="$(mktemp -d /tmp/restore.XXXXXX)"
AWS_ACCESS_KEY_ID="${RESTIC_AWS_ACCESS_KEY_ID:?}" \
  AWS_SECRET_ACCESS_KEY="${RESTIC_AWS_SECRET_ACCESS_KEY:?}" \
  restic restore "$snapshot" --target "$out" >/dev/null
[ -f "$out/db/pets.dump" ] || die "snapshot $snapshot has no db/pets.dump"

pg_restore --no-owner --exit-on-error --dbname "$target" "$out/db/pets.dump"
psql -At -F ' ' -d "$target" -f /opt/backup/counts.sql > "$out/db/row-counts.restored.txt"
if ! diff "$out/db/row-counts.txt" "$out/db/row-counts.restored.txt" >&2; then
  die "the row counts of $target differ from the snapshot's (above: < snapshot, > restored)"
fi
echo "database $target: $(wc -l < "$out/db/row-counts.txt" | tr -d ' ') tables, counts match"

mkdir -p "$out/media"
(cd "$out/media" && find . -type f | sort) > "$out/db/media-manifest.restored.txt"
if ! diff "$out/db/media-manifest.txt" "$out/db/media-manifest.restored.txt" >&2; then
  die "the restored media differ from the snapshot's manifest"
fi
echo "media: $(wc -l < "$out/db/media-manifest.txt" | tr -d ' ') files under $out/media, manifest matches"
