#!/bin/sh
# Restore a snapshot into a scratch directory, and the database into a
# database of a given name (never over the live one unless asked by name).
#
#   restore.sh <snapshot-id|latest> <target-database>
set -eu
snapshot="${1:?snapshot id or latest}"
target="${2:?target database name}"
out="/tmp/restore-${snapshot}"
restic restore "$snapshot" --target "$out"
createdb "$target" 2>/dev/null || true
pg_restore --no-owner --clean --if-exists --dbname "$target" "$out/db/pets.dump"
echo "restored the database into ${target}; media files are under ${out}/media"
cat "$out/db/row-counts.txt"
