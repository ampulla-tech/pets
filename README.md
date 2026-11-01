# pets

A digital vaccination card for dogs and cats: vaccines, antiparasitics,
weight, notes and visits per animal; the history loaded from photos of the
paper card; revaccination reminders by push and e-mail to every tutor; each
animal shared with its tutors and guests. In one repository: the API, the web
app and the native app (ADR-0001).

| Directory | What it is | Tooling |
|---|---|---|
| [`backend/`](./backend/README.md) | Django 6 + Django Ninja API. It owns the accounts (allauth headless, ADR-0002), the animals and their records, the reminders and their daily sending, and the photo reading. Production in [`backend/deploy/`](./backend/deploy/RUNBOOK.md). | Python 3.13 · uv · ruff · pytest |
| [`web/`](./web) | The web app (React · Vite · Tailwind v4 · shadcn/ui), installable as a PWA. | Node 22 · pnpm |
| [`mobile/`](./mobile/README.md) | The native app for iOS and Android (React Native · Expo). | Node 22 · pnpm · Xcode · Android Studio |
| [`packages/core/`](./packages/core) | `@pets/core`: the API client generated from the backend's OpenAPI, the identity client, the domain as the screens say it, the strings and the theme. | Node 22 · pnpm |
| [`backup/`](./backup/README.md) | The nightly backup of the database and the media to restic. | Docker · shell |
| [`docs/`](./docs) | The glossary ([`docs/agents/domain.md`](./docs/agents/domain.md)), the decisions ([`docs/adr/`](./docs/adr)), the flows and the benchmark report. | |

Each directory has its own path-filtered workflow in `.github/workflows/`.

## Getting started

```bash
docker compose up                       # Postgres, the API on :8300, the reading worker, Mailpit
docker compose exec pets python manage.py seed_demo   # demo@example.com / pets-demo-2026
pnpm install && pnpm dev                # the web app on http://localhost:5180
pnpm --filter pets-mobile start         # the native app (see mobile/README.md)
```

Every e-mail the local API sends (the code that confirms a new account's
e-mail, the password reset code, the reminders) lands in Mailpit, never in a
real inbox: open **http://localhost:8325** to read it. A new account is usable
only after its code is typed (ADR-0002); the demo account is already
confirmed.

From a phone on the same Wi-Fi, start the stack with the machine's address,
`HOST_IP=<your-lan-ip> docker compose up`, and open `http://<your-lan-ip>:5180`
(serve the web app on the network with `pnpm --filter @pets/web dev --host`); Mailpit is at `http://<your-lan-ip>:8325`.

## The shared package's generated code

```bash
packages/core/scripts/openapi.sh                # the API's OpenAPI document
pnpm --filter @pets/core generate               # the client and the theme
```

CI regenerates both and fails when the committed output differs.
