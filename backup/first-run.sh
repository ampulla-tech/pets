#!/bin/sh
# Makes sure the backup can run, from the deploy and never by hand. Run by
# deploy.sh in the backup container after every deploy:
#
#   1. The restic repository at RESTIC_REPOSITORY exists, or is initialised.
#      Only restic's "repository does not exist" (exit 10) leads to `init`: a
#      wrong password (12), a refused key or an unreachable endpoint fail here,
#      so a repository that exists is never shadowed by a new one.
#   2. It holds a snapshot of this host. If not, which is a first deploy, it
#      takes one with backup.sh, then restores it into a scratch database with
#      restore.sh, which checks counts and manifest, and drops the scratch
#      copy. A backup that cannot be read back fails the deploy on day one,
#      not on the day it is needed.
#
# Prints one line per outcome and exits non-zero on any failure. On a host
# that already has snapshots it only reads the repository.
set -eu

: "${RESTIC_REPOSITORY:?}" "${RESTIC_PASSWORD:?}" "${DUMP_RESTIC_HOST:?}"
export AWS_ACCESS_KEY_ID="${RESTIC_AWS_ACCESS_KEY_ID:?}"
export AWS_SECRET_ACCESS_KEY="${RESTIC_AWS_SECRET_ACCESS_KEY:?}"

rc=0
restic cat config >/dev/null 2>&1 || rc=$?
case "$rc" in
0) echo "first-run: repository exists" ;;
10)
  restic init >/dev/null
  echo "first-run: repository initialised"
  ;;
*)
  echo "first-run: FAIL: restic cannot open the repository (exit $rc)" >&2
  restic cat config >/dev/null || true
  exit 1
  ;;
esac

count="$(restic snapshots --host "$DUMP_RESTIC_HOST" --json | grep -o '"short_id"' | wc -l)"
if [ "$count" -gt 0 ]; then
  echo "first-run: $count snapshot(s) of $DUMP_RESTIC_HOST, nothing to do"
  exit 0
fi

unset AWS_ACCESS_KEY_ID AWS_SECRET_ACCESS_KEY
/opt/backup/backup.sh
scratch="first_run_check_$(date +%s)"
/opt/backup/restore.sh latest "$scratch"
dropdb "$scratch"
rm -rf /tmp/restore.*
echo "first-run: first backup taken and restored"
