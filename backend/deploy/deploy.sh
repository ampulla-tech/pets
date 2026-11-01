#!/usr/bin/env bash
# Deploys one tag of Pets on the VPS. Run as `deploy` by the deploy job of
# Backend CI, which copies this file and compose.prod.yml into
# /home/deploy/pets/release/ first, then runs:
#
#   bash pets/release/deploy.sh <tag> < secrets
#
# stdin carries the host's configuration as KEY=value lines, one per line,
# never on the command line, so no value shows up in `ps`. Exactly the keys in
# ENV_KEYS, PETS_KEYS and BACKUP_KEYS below must be present, each once, none
# empty; the keys in BACKUP_OPTIONAL_KEYS may be given, empty or not, at most
# once. Anything else is refused before the host is touched. No value is ever
# printed.
#
# What it does, in order:
#
#   1. Keeps the running release (compose file, .env, .env.pets, .env.backup)
#      in previous/, which also records the running tag.
#   2. Installs the new compose file and writes .env, .env.pets and
#      .env.backup, mode 0600, with the new tag.
#   3. Pulls the images, then runs `migrate --noinput` as a one-off container
#      on the new tag, against the running Postgres. The one-off runs as the
#      worker, which carries no proxy labels, so the edge proxy never routes a
#      request to it.
#   4. Only if all of that passed, recreates the API, the worker, cron and the
#      backup on the new tag.
#   5. Asks the new API for /health, from inside its container (the edge proxy
#      and DNS are not on the path), until it answers 200 or HEALTH_TIMEOUT
#      seconds pass.
#
# A failure before step 4 puts previous/ back in place and exits non-zero. No
# container of the running release was recreated, so the old version keeps
# serving. Migrations are additive (expand, then contract), so the old code
# runs on the migrated schema.
#
# A failure in step 4 or 5 goes back: previous/ is put back, the services are
# recreated on the kept tag, and its /health is checked the same way. The
# script then exits 1 whether or not the way back worked, so the job is red
# every time the new tag did not stay up. A first boot has nothing to go back
# to and just exits 1.
#
# Environment, for the test harness only: PETS_DIR (default ~/pets),
# COMPOSE_PROJECT_NAME (default `pets`, from the compose file),
# HEALTH_TIMEOUT (default 60) and DEPLOY_SKIP_PULL (the harness's images are
# local and never pushed).
set -euo pipefail

# Compose's own configuration: read by Compose to fill compose.prod.yml.
ENV_KEYS="GHCR_OWNER POSTGRES_PASSWORD R2_ACCOUNT_ID"
# The API's secrets, handed to the API, the worker and cron. AWS_* are the
# media bucket's read-write keys. RESEND_API_KEY is required: without it the
# API would print the e-mail codes to its log and no one could sign up or
# recover a password.
PETS_KEYS="DJANGO_SECRET_KEY AWS_ACCESS_KEY_ID AWS_SECRET_ACCESS_KEY RESEND_API_KEY OPENROUTER_API_KEY VAPID_PUBLIC_KEY VAPID_PRIVATE_KEY"
# The backup's secrets, handed to the backup only: the restic password and the
# repository's read-write keys, the media bucket's read-only keys.
BACKUP_KEYS="RESTIC_PASSWORD RESTIC_AWS_ACCESS_KEY_ID RESTIC_AWS_SECRET_ACCESS_KEY MEDIA_S3_ACCESS_KEY_ID MEDIA_S3_SECRET_ACCESS_KEY"
# The heartbeat pinged after each backup, if there is one.
BACKUP_OPTIONAL_KEYS="BACKUP_PING_URL"

here="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
pets_dir="${PETS_DIR:-$HOME/pets}"
previous="$pets_dir/previous"
health_timeout="${HEALTH_TIMEOUT:-60}"
files="compose.prod.yml .env .env.pets .env.backup"

log() { echo "deploy: $*"; }
die() {
  echo "deploy: FAIL: $*" >&2
  exit 1
}

[ $# -eq 1 ] || die "usage: deploy.sh <tag> < secrets"
tag="$1"
[[ "$tag" =~ ^[A-Za-z0-9_.-]+$ ]] || die "the tag has characters outside [A-Za-z0-9_.-]"
[ -f "$here/compose.prod.yml" ] || die "no compose.prod.yml beside deploy.sh"

# --- Read and check the configuration, before anything on the host changes ---

optional() {
  case " $BACKUP_OPTIONAL_KEYS " in
  *" $1 "*) return 0 ;;
  esac
  return 1
}

declare -A value=() seen=()
while IFS= read -r line || [ -n "$line" ]; do
  [ -n "$line" ] || continue
  key="${line%%=*}"
  [ "$key" != "$line" ] || die "a stdin line has no '=' (its value is not shown)"
  case " $ENV_KEYS $PETS_KEYS $BACKUP_KEYS $BACKUP_OPTIONAL_KEYS " in
  *" $key "*) ;;
  *) die "unknown key on stdin: $key" ;;
  esac
  [ -z "${seen[$key]+set}" ] || die "$key is given twice"
  seen[$key]=1
  val="${line#*=}"
  if [ -z "$val" ]; then
    optional "$key" || die "$key is empty"
    continue
  fi
  # Values are written single-quoted, which Compose reads literally (no
  # interpolation of '$'), so a single quote is the one thing they cannot hold.
  [[ "$val" != *"'"* ]] || die "$key holds a single quote"
  value[$key]="$val"
done
for key in $ENV_KEYS $PETS_KEYS $BACKUP_KEYS; do
  [ -n "${value[$key]+set}" ] || die "$key is missing on stdin"
done
backup_keys="$BACKUP_KEYS"
for key in $BACKUP_OPTIONAL_KEYS; do
  [ -z "${value[$key]+set}" ] || backup_keys="$backup_keys $key"
done

docker network inspect edge >/dev/null 2>&1 ||
  die "the host has no 'edge' Docker network (the edge proxy's, set up by the infra repository)"

# --- One deploy at a time ---

install -d -m 0700 "$pets_dir"
exec 9>"$pets_dir/.deploy.lock"
flock -n 9 || die "another deploy is running"

compose() {
  docker compose -f "$pets_dir/compose.prod.yml" "$@"
}

running_tag() {
  # The tag in the installed .env, quoted or not; empty on a first boot.
  [ -f "$pets_dir/.env" ] || return 0
  sed -n "s/^IMAGE_TAG=['\"]\{0,1\}\([^'\"]*\)['\"]\{0,1\}$/\1/p" "$pets_dir/.env"
}

# write_env <file> <keys...>: the file is written whole under a temporary name
# and moved into place, so it is never seen half written or with a wider mode.
write_env() {
  local file="$1" key
  shift
  (
    umask 077
    for key in "$@"; do
      printf "%s='%s'\n" "$key" "${value[$key]}"
    done >"$file.new"
  )
  chmod 0600 "$file.new"
  mv -f "$file.new" "$file"
}

# --- Keep the running release ---

from="$(running_tag)"
log "running ${from:-nothing}, deploying $tag"

have_previous=0
if [ -f "$pets_dir/.env" ]; then
  rm -rf "$previous.new"
  install -d -m 0700 "$previous.new"
  for f in $files; do
    [ ! -f "$pets_dir/$f" ] || cp -p "$pets_dir/$f" "$previous.new/$f"
  done
  rm -rf "$previous"
  mv "$previous.new" "$previous"
  have_previous=1
fi

put_back() {
  for f in $files; do
    [ ! -f "$previous/$f" ] || cp -p "$previous/$f" "$pets_dir/$f"
  done
}

restore() {
  if [ "$have_previous" = 1 ]; then
    put_back
    log "put the running release ($from) back; nothing was recreated"
  else
    log "first boot: nothing to put back"
  fi
}

# healthy: 0 once the API answers /health with 200, from inside its container.
# Each try is one request; the container may be restarting between tries, so a
# failed exec is retried too. The Host is the first of DJANGO_ALLOWED_HOSTS
# (any other gets a 400), and X-Forwarded-Proto says https as the edge proxy
# does.
healthy() {
  local deadline=$((SECONDS + health_timeout)) status
  while :; do
    status="$(compose exec -T pets python -c '
import os, urllib.error, urllib.request
host = os.environ["DJANGO_ALLOWED_HOSTS"].split(",")[0].strip()
req = urllib.request.Request(
    "http://127.0.0.1:8000/health",
    headers={"Host": host, "X-Forwarded-Proto": "https"},
)
try:
    print(urllib.request.urlopen(req, timeout=5).status)
except urllib.error.HTTPError as e:
    print(e.code)
except OSError:
    print("no answer")
' 2>/dev/null)" || status="no container"
    [ "$status" != 200 ] || return 0
    if [ "$SECONDS" -ge "$deadline" ]; then
      log "/health: $status after ${health_timeout}s"
      return 1
    fi
    sleep 2
  done
}

# go_back <why>: the new tag is live and failed. Recreate the kept release and
# exit 1 in every case.
go_back() {
  [ "$have_previous" = 1 ] || die "$1 on $tag; first boot, nothing to go back to"
  log "$1 on $tag; going back to $from"
  put_back
  compose up -d --wait --wait-timeout 180 --remove-orphans ||
    die "$1 on $tag, and $from did not start again either"
  healthy || die "$1 on $tag, and $from does not answer /health either"
  die "$1 on $tag; went back to $from, which answers /health"
}

switched=0
on_exit() {
  local rc=$?
  if [ "$rc" -ne 0 ] && [ "$switched" = 0 ]; then
    restore
  fi
  exit "$rc"
}
trap on_exit EXIT
trap 'exit 129' HUP
trap 'exit 130' INT
trap 'exit 143' TERM

# --- Install the new release ---

install -m 0644 "$here/compose.prod.yml" "$pets_dir/compose.prod.yml.new"
mv -f "$pets_dir/compose.prod.yml.new" "$pets_dir/compose.prod.yml"
value[COMPOSE_FILE]=compose.prod.yml
value[IMAGE_TAG]="$tag"
# shellcheck disable=SC2086 # the key lists are word lists
write_env "$pets_dir/.env" COMPOSE_FILE IMAGE_TAG $ENV_KEYS
# shellcheck disable=SC2086
write_env "$pets_dir/.env.pets" $PETS_KEYS
# shellcheck disable=SC2086
write_env "$pets_dir/.env.backup" $backup_keys
compose config -q || die "compose.prod.yml does not resolve with the new .env"

if [ -n "${DEPLOY_SKIP_PULL:-}" ]; then
  log "pull skipped (DEPLOY_SKIP_PULL)"
else
  log "pull"
  compose pull --quiet pets backup || die "pull failed"
fi

# --- Migrate on the new tag, before anything is recreated ---

# Postgres is left alone when it already runs on the same configuration; on a
# first boot this starts it on its empty volume.
compose up -d --wait --wait-timeout 120 postgres || die "Postgres did not become healthy"
log "migrate on $tag"
compose run --rm --no-deps worker python manage.py migrate --noinput ||
  die "migrate failed on $tag"

# --- Switch ---

# From here on the new tag is live: a failure goes back through go_back, not
# through the exit trap.
switched=1
log "recreate the services on $tag"
compose up -d --wait --wait-timeout 180 --remove-orphans || go_back "the new release did not start"
log "/health on $tag, up to ${health_timeout}s"
healthy || go_back "/health does not answer 200"

log "done: $tag is running (previous: ${from:-none})"
