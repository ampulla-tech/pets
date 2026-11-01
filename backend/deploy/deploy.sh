#!/bin/sh
# Deploy one image tag on the VPS: migrate first, then recreate. If the
# migration fails, the running version stays up.
#
#   IMAGE_TAG=<sha> ./deploy.sh        (run in the deploy directory on the host)
set -eu
cd "$(dirname "$0")"
: "${IMAGE_TAG:?IMAGE_TAG is required}"
export IMAGE_TAG
sed -i.bak "s/^IMAGE_TAG=.*/IMAGE_TAG=${IMAGE_TAG}/" .env && rm -f .env.bak
docker compose -f compose.prod.yml pull pets backup
docker compose -f compose.prod.yml run --rm pets python manage.py migrate --noinput
docker compose -f compose.prod.yml up -d --remove-orphans
host="$(grep -o 'api\.[a-z.]*' Caddyfile | head -1)"
for _ in 1 2 3 4 5 6 7 8 9 10; do
  if curl -fsS "https://${host}/health" >/dev/null; then echo "deployed ${IMAGE_TAG}"; exit 0; fi
  sleep 3
done
echo "health check failed after deploy" >&2
exit 1
