#!/usr/bin/env bash
# Backup harness: a backup and a restore, end to end, with no cloud account.
# Builds the API and backup images, fills a source (a migrated database with a
# confirmed account, and two files in the media bucket of a MinIO standing in
# for R2), runs backup.sh as the nightly cron does, then restore.sh as the
# runbook's restore test does, and checks its output: counts and manifest
# match. A second restore into the same database, and one into the live
# database, must be refused. The same command runs in CI
# (.github/workflows/backend.yml).
set -euo pipefail

here="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
root="$(cd "$here/.." && pwd)"

export TEST_PETS_IMAGE=ci/pets:backup-test TEST_BACKUP_IMAGE=ci/pets-backup:backup-test

fail() {
  echo "FAIL: $*" >&2
  exit 1
}
stack() {
  docker compose -f "$here/test/compose.yml" "$@"
}
cleanup() {
  stack down -v --remove-orphans >/dev/null 2>&1 || true
}
trap cleanup EXIT
cleanup

echo "== Build the images"
docker build -q -f "$root/backend/Dockerfile" --target prod -t "$TEST_PETS_IMAGE" "$root" >/dev/null
docker build -q -f "$root/backup/Dockerfile" -t "$TEST_BACKUP_IMAGE" "$root" >/dev/null

echo "== Fill a source"
stack up -d --wait postgres >/dev/null
stack up -d minio >/dev/null
stack run --rm pets python manage.py migrate --noinput >/dev/null
stack run --rm pets python manage.py shell -c '
from allauth.account.models import EmailAddress
from accounts.models import User
user = User.objects.create_user(email="harness@example.com", password="harness-password-1")
EmailAddress.objects.create(user=user, email=user.email, verified=True, primary=True)
' >/dev/null
# MinIO has no healthcheck binary: wait for its port from the backup image.
# shellcheck disable=SC2016 # expands in the container
stack run --rm --no-deps backup bash -c '
  for _ in $(seq 1 60); do (exec 3<>/dev/tcp/minio/9000) 2>/dev/null && exit 0; sleep 1; done; exit 1' ||
  fail "MinIO did not answer"
# shellcheck disable=SC2016 # expands in the container
stack run --rm backup bash -c '
  set -euo pipefail
  export RCLONE_CONFIG_M_TYPE=s3 RCLONE_CONFIG_M_PROVIDER=Minio \
    RCLONE_CONFIG_M_ENDPOINT="$MEDIA_S3_ENDPOINT" \
    RCLONE_CONFIG_M_ACCESS_KEY_ID="$MEDIA_S3_ACCESS_KEY_ID" \
    RCLONE_CONFIG_M_SECRET_ACCESS_KEY="$MEDIA_S3_SECRET_ACCESS_KEY"
  rclone mkdir m:media
  rclone mkdir m:restic
  mkdir -p "/tmp/src/attachments/7"
  head -c 300000 /dev/urandom > "/tmp/src/attachments/7/card photo.jpg"
  printf "pdf\n" > /tmp/src/attachments/visit.pdf
  rclone copy /tmp/src m:media
' || fail "could not fill the media bucket"

echo "== First run: no repository yet"
out="$(stack run --rm backup /opt/backup/backup.sh 2>&1)" && fail "backup.sh ran without a repository: $out"
echo "backup.sh: refuses a repository that does not exist"
out="$(stack run --rm backup /opt/backup/first-run.sh 2>&1)" || fail "first-run.sh failed: $out"
for line in "first-run: repository initialised" "first-run: first backup taken and restored"; do
  grep -qx "$line" <<<"$out" || fail "first-run.sh did not print '$line': $out"
done
grep -qE '^database first_run_check_[0-9]+: [0-9]+ tables, counts match$' <<<"$out" ||
  fail "first-run.sh did not check its restore: $out"
left="$(stack exec -T postgres psql -U pets -d postgres -At -c \
  "SELECT count(*) FROM pg_database WHERE datname LIKE 'first_run_check_%'")"
[ "$left" = 0 ] || fail "first-run.sh left $left scratch databases"
echo "first-run.sh: initialised, backed up, restored and checked, scratch dropped"

out="$(stack run --rm backup /opt/backup/first-run.sh 2>&1)" || fail "a second first-run.sh failed: $out"
if ! grep -qx "first-run: repository exists" <<<"$out" || ! grep -q "nothing to do$" <<<"$out"; then
  fail "a second first-run.sh did something: $out"
fi
echo "first-run.sh: a second run only reads"

out="$(stack run --rm -e RESTIC_PASSWORD=wrong-password backup /opt/backup/first-run.sh 2>&1)" &&
  fail "first-run.sh accepted a wrong password: $out"
grep -q "restic cannot open the repository" <<<"$out" || fail "unexpected failure with a wrong password: $out"
echo "first-run.sh: a wrong password fails, nothing initialised"

echo "== Back it up"
out="$(stack run --rm backup /opt/backup/backup.sh 2>&1)" || fail "backup.sh failed: $out"
grep -q '^backup done$' <<<"$out" || fail "backup.sh did not finish: $out"

echo "== Restore it"
restore() {
  stack run --rm backup /opt/backup/restore.sh latest "$1" 2>&1
}
out="$(restore pets_restore)" || fail "restore.sh failed: $out"
echo "$out"
grep -qE '^database pets_restore: [0-9]+ tables, counts match$' <<<"$out" || fail "no matching counts line"
grep -qE '^media: 2 files under /tmp/restore\.[A-Za-z0-9]+/media, manifest matches$' <<<"$out" ||
  fail "no matching media line"
users="$(stack exec -T postgres psql -U pets -d pets_restore -At -c \
  "SELECT count(*) FROM accounts_user WHERE email = 'harness@example.com'")"
[ "$users" = 1 ] || fail "the restored database has $users harness accounts, want 1"
echo "Restore: counts and manifest match, the account is there"

echo "== Refuse a target that holds data"
for target in pets_restore pets; do
  if out="$(restore "$target")"; then
    fail "a restore into $target exited 0"
  fi
  grep -q "already holds data" <<<"$out" || fail "unexpected failure restoring into $target: $out"
  echo "Restore: refuses $target, which already holds data"
done

echo "OK"
