# backend

The pets API: Django 6, Django Ninja and allauth headless.

| Path | What |
|---|---|
| `GET /health` | Liveness probe |
| `/_allauth/app/v1/*` | allauth headless ("app" client): sign-up, sign-in, sign-out, password reset by code |
| `/animals…` | Animals, their photo, records, accesses, invites, reminders, card and its PDF |
| `/reminders/upcoming` | What is overdue or due within 30 days, across the caller's animals |
| `/extractions…` | Photo intake: the reading of a card's photos and the review of its proposals |
| `/push…` | Expo tokens and web-push subscriptions |
| `/files/<signed>` | A stored file behind a signed, expiring link |

Every route but `/health`, `/catalog`, the invite preview and the files needs
the `X-Session-Token` header allauth answered at sign-in (ADR-0002). Access to
an animal is checked on every route (`animals/access.py`, ADR-0006).

## Processes

- The API (`granian` in production, `runserver` locally).
- `python manage.py run_intake_worker`: reads card photos outside the request
  (ADR-0005).
- `crontab`, run by supercronic in the `cron` service: `send_reminders` once a
  day at 09:00 Brasília time (ADR-0004).

## Configuration

Environment variables (see `config/settings.py`); locally `backend/.env`,
never committed. With no `AWS_STORAGE_BUCKET_NAME` media stays on disk; with
no `RESEND_API_KEY` mail goes to the SMTP server in `EMAIL_HOST` (Mailpit,
in the compose stack) or, with neither, is printed; with no
`OPENROUTER_API_KEY` or `INTAKE_MODEL` the photo reading answers
`unconfigured`; with no VAPID keys web push is off.

## The reading benchmark

```bash
uv run python manage.py benchmark_intake --models <id>,<id> --runs 3
```

The answer key and the photos hold third-party personal data. They live in
`backend/benchmark-data/` (`gabarito.json` and `photos/`), which is gitignored
and never committed; `--key` / `--photos` (or `PETS_BENCHMARK_KEY` /
`PETS_BENCHMARK_PHOTOS`) point elsewhere. The report (`docs/benchmark/card-reading.md`) holds aggregate
scores only. Every call is paid.

## Local development

```bash
uv sync --dev
uv run pytest            # needs the compose Postgres on :5435
uv run ruff check . && uv run ruff format --check .
```
