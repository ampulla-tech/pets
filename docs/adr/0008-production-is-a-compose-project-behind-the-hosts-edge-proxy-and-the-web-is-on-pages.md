# 0008. Production is a compose project behind the host's edge proxy, and the web app is on Cloudflare Pages

- Status: accepted
- Date: 2026-11-01

## Context

The API runs on a VPS that already runs other apps. One host has one pair of
ports 80 and 443, so a reverse proxy of this project's own cannot run there
beside the others. The web app is static files plus a service worker.

## Decision

- **The API, the worker, cron, Postgres and the backup are one compose project**
  (`backend/deploy/compose.prod.yml`) that publishes no port. The host's edge
  proxy, Caddy with caddy-docker-proxy (owned by the infra repository), holds
  the certificate for `api.pets.ampulla.tech` and finds the API by the `caddy`
  labels of its `pets` service on the external Docker network `edge`. Only
  that service joins `edge`.
- **The web app is published to Cloudflare Pages** (project `ampulla-pets`, at
  `pets.ampulla.tech`). Its caching rules are `web/public/_headers`; deep links
  rely on Pages' single-page-app fallback, so the build has no `404.html`.
- **A merge to `main` deploys both.** Backend CI pushes the two images to GHCR
  tagged with the commit and runs `deploy.sh` on the host over SSH: migrate on
  the new tag first, then recreate, then `/health` from inside the container,
  going back to the previous tag when the new one does not answer. Web CI
  publishes to Pages. Either deploy is skipped, with a warning, while its
  secrets are not set.
- **Media live in the R2 bucket `ampulla-pets-media`; the nightly restic
  snapshot (database and media) goes to `ampulla-backup-pets`**, read with a
  read-only key on the media bucket.

## Consequences

- Nothing in this repository configures TLS, ports or DNS; a change of host
  name is the `caddy` label, the Django host and origin settings, and
  `web/.env.production`.
- The deploy and the backup are tested on every change without a VPS or a
  cloud account (`backend/deploy/compose-test.sh`, `backup/test.sh`).

## Rejected

- **A Caddy of this project's own on ports 80 and 443.** It cannot share the
  host with another app's proxy.
- **Serving the web build from the VPS.** It ties every web change to a
  backend deploy, for files a CDN serves better.
