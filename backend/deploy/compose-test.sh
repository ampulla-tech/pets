#!/usr/bin/env bash
# Deploy harness: compose.prod.yml and deploy.sh on this machine, as the deploy
# job runs them on the VPS, with locally built images and dummy secrets.
#
#   1. A first deploy of a good tag: migrate, start, /health from inside.
#   2. What the edge proxy sees: only `pets` is on `edge`, with the labels the
#      runbook promises, and nothing publishes a port. A real
#      caddy-docker-proxy on `edge` (internal certificates, so nothing is asked
#      of Let's Encrypt) turns the labels into a site that answers /health on
#      api.pets.ampulla.tech and refuses a body over 30 MB.
#   3. The web's session across subdomains: the CSRF and session cookies are
#      set for pets.ampulla.tech, Secure, SameSite=Lax, the CSRF one readable;
#      CORS lets https://pets.ampulla.tech call with credentials; a write with
#      the cookie and X-CSRFToken from that origin passes, one from another
#      origin is refused; the session cookie then authenticates /me.
#   4. A tag whose migration fails: refused before anything is recreated, the
#      good tag keeps serving.
#   5. A tag that starts but never answers /health: deployed, then taken back
#      to the good tag, and the deploy exits non-zero.
#
# The same command runs in CI (.github/workflows/backend.yml).
set -euo pipefail

here="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
root="$(cd "$here/../.." && pwd)"

owner=ci
export COMPOSE_PROJECT_NAME=pets-deploy-test HEALTH_TIMEOUT=30 DEPLOY_SKIP_PULL=1
work="$(mktemp -d)"
export PETS_DIR="$work/pets"
edge_proxy=pets-deploy-test-edge
edge_port=18443
created_edge=0

fail() {
  echo "FAIL: $*" >&2
  exit 1
}
compose() {
  docker compose -f "$PETS_DIR/compose.prod.yml" "$@"
}
cleanup() {
  docker rm -f "$edge_proxy" >/dev/null 2>&1 || true
  [ ! -f "$PETS_DIR/compose.prod.yml" ] || compose down -v --remove-orphans >/dev/null 2>&1 || true
  [ "$created_edge" = 0 ] || docker network rm edge >/dev/null 2>&1 || true
  rm -rf "$work"
}
trap cleanup EXIT

# The values the deploy job sends on stdin, all dummies.
secrets() {
  printf '%s\n' \
    "GHCR_OWNER=$owner" \
    "POSTGRES_PASSWORD=harness-db" \
    "R2_ACCOUNT_ID=harness-account" \
    "DJANGO_SECRET_KEY=harness-secret-key-harness-secret-key-harness-secret" \
    "AWS_ACCESS_KEY_ID=harness" \
    "AWS_SECRET_ACCESS_KEY=harness" \
    "RESEND_API_KEY=re_harness" \
    "OPENROUTER_API_KEY=sk-harness" \
    "VAPID_PUBLIC_KEY=harness" \
    "VAPID_PRIVATE_KEY=harness" \
    "RESTIC_PASSWORD=harness" \
    "RESTIC_AWS_ACCESS_KEY_ID=harness" \
    "RESTIC_AWS_SECRET_ACCESS_KEY=harness" \
    "MEDIA_S3_ACCESS_KEY_ID=harness" \
    "MEDIA_S3_SECRET_ACCESS_KEY=harness" \
    "BACKUP_PING_URL="
}
deploy() {
  mkdir -p "$PETS_DIR/release"
  cp "$here/compose.prod.yml" "$here/deploy.sh" "$PETS_DIR/release/"
  secrets | bash "$PETS_DIR/release/deploy.sh" "$1" 2>&1
}
running_tag() {
  docker inspect --format '{{.Config.Image}}' "$(compose ps -q pets)" | sed 's/.*://'
}

echo "== Build the images"
docker build -q -f "$root/backend/Dockerfile" --target prod -t "ghcr.io/$owner/pets:good" "$root" >/dev/null
docker build -q -f "$root/backup/Dockerfile" -t "ghcr.io/$owner/pets-backup:good" "$root" >/dev/null
leaf="$(basename "$(find "$root/backend/accounts/migrations" -name '0*.py' | sort | tail -1)" .py)"
bad="$work/bad-migration"
mkdir -p "$bad"
cat >"$bad/9999_fails_on_purpose.py" <<EOF
from django.db import migrations


def fail(apps, schema_editor):
    raise RuntimeError("this migration fails on purpose")


class Migration(migrations.Migration):
    dependencies = [("accounts", "$leaf")]
    operations = [migrations.RunPython(fail)]
EOF
printf 'FROM ghcr.io/%s/pets:good\nCOPY 9999_fails_on_purpose.py accounts/migrations/\n' "$owner" |
  docker build -q -t "ghcr.io/$owner/pets:bad-migration" -f - "$bad" >/dev/null
printf 'FROM ghcr.io/%s/pets:good\nCMD ["sleep", "infinity"]\n' "$owner" |
  docker build -q -t "ghcr.io/$owner/pets:no-health" - >/dev/null
for tag in bad-migration no-health; do
  docker tag "ghcr.io/$owner/pets-backup:good" "ghcr.io/$owner/pets-backup:$tag"
done

if ! docker network inspect edge >/dev/null 2>&1; then
  docker network create edge >/dev/null
  created_edge=1
fi

echo "== 1. First deploy"
out="$(deploy good)" || fail "the first deploy failed: $out"
echo "$out" | grep '^deploy:'
grep -q '^deploy: done: good is running' <<<"$out" || fail "the first deploy did not finish"
for f in .env .env.pets .env.backup; do
  mode="$(stat -c '%a' "$PETS_DIR/$f" 2>/dev/null || stat -f '%Lp' "$PETS_DIR/$f")"
  [ "$mode" = 600 ] || fail "$f has mode $mode, want 600"
done
! grep -q BACKUP_PING_URL "$PETS_DIR/.env.backup" || fail "an empty BACKUP_PING_URL reached .env.backup"

echo "== 2. What the edge proxy sees"
pets_id="$(compose ps -q pets)"
labels="$(docker inspect --format '{{json .Config.Labels}}' "$pets_id")"
python3 - "$labels" <<'EOF'
import json, sys
labels = json.loads(sys.argv[1])
want = {
    "caddy": "api.pets.ampulla.tech",
    "caddy.reverse_proxy": "{{upstreams 8000}}",
    "caddy.encode": "zstd gzip",
    "caddy.request_body.max_size": "30MB",
}
for key, value in want.items():
    assert labels.get(key) == value, (key, labels.get(key))
EOF
for service in pets worker cron postgres backup; do
  id="$(compose ps -q "$service")"
  [ -n "$id" ] || fail "$service is not running"
  networks="$(docker inspect --format '{{range $k, $v := .NetworkSettings.Networks}}{{$k}} {{end}}' "$id")"
  ports="$(docker inspect --format '{{json .HostConfig.PortBindings}}' "$id")"
  [ "$ports" = "{}" ] || [ "$ports" = "null" ] || fail "$service publishes $ports"
  case "$service" in
  pets) [[ " $networks " == *" edge "* ]] || fail "pets is not on edge: $networks" ;;
  *) [[ " $networks " != *" edge "* ]] || fail "$service is on edge: $networks" ;;
  esac
  # The worker, cron and the backup carry no proxy labels.
  if [ "$service" != pets ]; then
    docker inspect --format '{{json .Config.Labels}}' "$id" | grep -q '"caddy' &&
      fail "$service carries caddy labels"
  fi
done
echo "Only pets is on edge, with the labels; no service publishes a port"

docker run -d --name "$edge_proxy" --network edge -p "127.0.0.1:$edge_port:443" \
  -e CADDY_INGRESS_NETWORKS=edge -l caddy.local_certs= \
  -v /var/run/docker.sock:/var/run/docker.sock:ro \
  lucaslorentz/caddy-docker-proxy:2.13.1-alpine >/dev/null
via_edge() {
  curl -sk --resolve "api.pets.ampulla.tech:$edge_port:127.0.0.1" "$@"
}
code=""
for _ in $(seq 1 30); do
  code="$(via_edge -o /dev/null -w '%{http_code}' "https://api.pets.ampulla.tech:$edge_port/health" || true)"
  [ "$code" = 200 ] && break
  sleep 2
done
[ "$code" = 200 ] || {
  docker logs "$edge_proxy" 2>&1 | tail -20
  fail "/health through the edge proxy answered $code"
}
via_edge -D - -o /dev/null -H 'Accept-Encoding: gzip' "https://api.pets.ampulla.tech:$edge_port/catalog" |
  grep -qi '^content-encoding: gzip' || fail "the edge proxy does not compress"
code="$(head -c 31457281 /dev/zero | via_edge -o /dev/null -w '%{http_code}' -X POST \
  -H 'Content-Type: application/octet-stream' --data-binary @- "https://api.pets.ampulla.tech:$edge_port/health")"
[ "$code" = 413 ] || fail "a body over 30 MB through the edge proxy answered $code, want 413"
echo "Edge proxy: /health 200 on api.pets.ampulla.tech, gzip, a body over 30 MB gets 413"
docker exec "$edge_proxy" cat /config/caddy/Caddyfile.autosave

echo "== 3. The web's session across subdomains"
compose exec -T pets python manage.py shell -c '
from allauth.account.models import EmailAddress
from accounts.models import User
user = User.objects.create_user(email="deploy-harness@example.com", password="harness-password-1")
EmailAddress.objects.create(user=user, email=user.email, verified=True, primary=True)
' >/dev/null
compose exec -T pets python - <<'EOF' || fail "the cross-subdomain session"
import http.client, json
from http.cookies import SimpleCookie

WEB = "https://pets.ampulla.tech"
BASE = {"Host": "api.pets.ampulla.tech", "X-Forwarded-Proto": "https"}
jar = {}


def call(method, path, headers=None, body=None):
    conn = http.client.HTTPConnection("127.0.0.1", 8000, timeout=10)
    h = dict(BASE, **(headers or {}))
    if jar:
        h["Cookie"] = "; ".join(f"{k}={v}" for k, v in jar.items())
    conn.request(method, path, body=json.dumps(body) if body is not None else None, headers=h)
    r = conn.getresponse()
    r.read()
    cookies = {}
    for header in r.headers.get_all("Set-Cookie") or []:
        c = SimpleCookie()
        c.load(header)
        for name, morsel in c.items():
            cookies[name] = (morsel, header)
            jar[name] = morsel.value
    return r, cookies


def assert_cookie(cookies, name, httponly):
    morsel, header = cookies[name]
    assert morsel["domain"] == "pets.ampulla.tech", header
    assert morsel["secure"], header
    assert morsel["samesite"] == "Lax", header
    assert bool(morsel["httponly"]) == httponly, header


r, cookies = call("GET", "/_allauth/browser/v1/auth/session", {"Origin": WEB})
assert r.status == 401, r.status
assert r.headers["Access-Control-Allow-Origin"] == WEB, r.headers
assert r.headers["Access-Control-Allow-Credentials"] == "true", r.headers
assert "csrftoken" in cookies, r.headers
assert_cookie(cookies, "csrftoken", httponly=False)

r, _ = call("OPTIONS", "/_allauth/browser/v1/auth/login", {
    "Origin": WEB,
    "Access-Control-Request-Method": "POST",
    "Access-Control-Request-Headers": "content-type,x-csrftoken",
})
assert r.status == 200, r.status
assert r.headers["Access-Control-Allow-Origin"] == WEB, r.headers
assert "x-csrftoken" in r.headers["Access-Control-Allow-Headers"].lower(), r.headers

login = {"email": "deploy-harness@example.com", "password": "harness-password-1"}
csrf = jar["csrftoken"]
r, _ = call("POST", "/_allauth/browser/v1/auth/login",
            {"Origin": "https://evil.example", "X-CSRFToken": csrf, "Content-Type": "application/json"}, login)
assert r.status == 403, f"a write from another origin answered {r.status}"
r, _ = call("POST", "/_allauth/browser/v1/auth/login",
            {"Origin": WEB, "Content-Type": "application/json"}, login)
assert r.status == 403, f"a write without X-CSRFToken answered {r.status}"
r, cookies = call("POST", "/_allauth/browser/v1/auth/login",
                  {"Origin": WEB, "X-CSRFToken": csrf, "Content-Type": "application/json"}, login)
assert r.status == 200, f"the web's sign-in answered {r.status}"
assert_cookie(cookies, "sessionid", httponly=True)

r, _ = call("GET", "/me", {"Origin": WEB})
assert r.status == 200, f"/me with the session cookie answered {r.status}"
print("Session: csrftoken and sessionid on pets.ampulla.tech, Secure, SameSite=Lax; "
      "CORS with credentials for the web; another origin and a missing token get 403; /me 200")
EOF

echo "== 4. A migration that fails"
if out="$(deploy bad-migration)"; then
  fail "a deploy whose migration fails exited 0"
fi
echo "$out" | grep '^deploy:'
grep -q 'migrate failed on bad-migration' <<<"$out" || fail "unexpected failure: $out"
[ "$(running_tag)" = good ] || fail "pets runs $(running_tag) after a failed migration, want good"
grep -q "^IMAGE_TAG='good'$" "$PETS_DIR/.env" || fail ".env was not put back"
echo "A failed migration recreates nothing; good keeps serving"

echo "== 5. A tag that never answers /health"
if out="$(deploy no-health)"; then
  fail "a deploy whose /health fails exited 0"
fi
echo "$out" | grep '^deploy:'
grep -q 'went back to good, which answers /health' <<<"$out" || fail "unexpected failure: $out"
[ "$(running_tag)" = good ] || fail "pets runs $(running_tag) after the way back, want good"
echo "A tag without /health is taken back to good"

echo "OK"
