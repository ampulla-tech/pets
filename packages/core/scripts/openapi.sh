#!/bin/sh
# Export the API's OpenAPI document from the backend into openapi.json beside
# this script's package; the client is generated from it:
#
#   packages/core/scripts/openapi.sh && pnpm --filter @pets/core generate:api
set -eu
core="$(cd "$(dirname "$0")/.." && pwd)"
cd "$core/../../backend"
uv run python manage.py export_openapi_schema \
  --api config.api.api --indent 2 --sorted --output "$core/openapi.json"
