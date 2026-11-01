# Production runbook

Pets in production: the API at `https://api.pets.ampulla.tech` and the web app
at `https://pets.ampulla.tech` (provisional names; changing them is DNS plus
the names in `compose.prod.yml` and `Caddyfile`). One VPS runs everything in
`compose.prod.yml`: Caddy, the API, the photo-reading worker, the scheduled
commands, Postgres and the nightly backup. Media lives in a private
S3-compatible bucket, never on the container's disk.

## What it needs (none of it is in the repository)

| What | Where it goes |
|---|---|
| A VPS with Docker and SSH access for a `deploy` user | the host |
| DNS: `api.pets.ampulla.tech` and `pets.ampulla.tech` pointing at the VPS | the DNS zone |
| A private bucket and a read-write key pair for the API | `.env.pets` |
| A read-only key pair for the same bucket | `.env.backup` |
| A restic repository (another bucket) and its password | `.env.backup` |
| The Resend API key, with the sending domain verified | `.env.pets` |
| `DJANGO_SECRET_KEY` (50+ random characters) | `.env.pets` |
| VAPID key pair for web push | `.env.pets` |
| The OpenRouter key and the benchmark's chosen `INTAKE_MODEL` | `.env.pets` |

**A host that already runs another Caddy on ports 80 and 443** cannot run this
file's Caddy as is: either give Pets its own host, or drop the `caddy` service
and add the two site blocks of `Caddyfile` to the existing Caddy, on a shared
Docker network with the `pets` service.

## First install

On the host, in `/srv/pets` (owned by `deploy`):

1. Copy `compose.prod.yml`, `Caddyfile` and `deploy.sh` there.
2. Write `.env` (mode 0600):

   ```
   GHCR_OWNER=ampulla-tech
   IMAGE_TAG=<sha>
   POSTGRES_PASSWORD=<random>
   ```

3. Write `.env.pets` (mode 0600):

   ```
   DJANGO_SECRET_KEY=<random>
   AWS_STORAGE_BUCKET_NAME=<bucket>
   AWS_S3_ENDPOINT_URL=https://<account>.r2.cloudflarestorage.com
   AWS_ACCESS_KEY_ID=<read-write key>
   AWS_SECRET_ACCESS_KEY=<read-write secret>
   RESEND_API_KEY=<key>
   DEFAULT_FROM_EMAIL=pets@ampulla.tech
   OPENROUTER_API_KEY=<key>
   INTAKE_MODEL=openai/gpt-6.1-terra   # ADR-0007
   VAPID_PUBLIC_KEY=<base64url public key>
   VAPID_PRIVATE_KEY=<PEM, newlines escaped>
   ```

   Generate the VAPID pair with
   `docker compose -f compose.prod.yml run --rm pets python -c "from py_vapid import Vapid; v=Vapid(); v.generate_keys(); v.save_key('/tmp/k.pem'); print(v.public_key)"`,
   or any VAPID generator; the public half is also what the web app subscribes with
   (the API serves it at `/push/webpush/key`).

4. Write `.env.backup` (mode 0600):

   ```
   RESTIC_REPOSITORY=s3:https://<account>.r2.cloudflarestorage.com/<backup-bucket>
   RESTIC_PASSWORD=<random, kept in the password manager too>
   AWS_ACCESS_KEY_ID=<restic bucket key>
   AWS_SECRET_ACCESS_KEY=<restic bucket secret>
   MEDIA_S3_ENDPOINT=https://<account>.r2.cloudflarestorage.com
   MEDIA_S3_BUCKET=<media bucket>
   MEDIA_S3_ACCESS_KEY_ID=<read-only key>
   MEDIA_S3_SECRET_ACCESS_KEY=<read-only secret>
   HEARTBEAT_URL=<optional>
   ```

5. Put the web build in `/srv/pets/web` (`pnpm --filter @pets/web build`, then
   copy `web/dist/` there).
6. `IMAGE_TAG=<sha> ./deploy.sh`. It migrates, recreates and checks
   `/health`.

## Deploying a new version

Build and push the images (`ghcr.io/<owner>/pets` from `backend/Dockerfile`,
target `prod`; `ghcr.io/<owner>/pets-backup` from `backup/Dockerfile`, both
from the repository root), then on the host: `IMAGE_TAG=<sha> ./deploy.sh`.
A failed migration leaves the running version up.

## Checks

- `curl https://api.pets.ampulla.tech/health` answers `{"status": "ok"}`.
- `docker compose -f compose.prod.yml exec backup restic snapshots` lists the
  night's snapshot with `db` and `media`.
- Signing up on the web app e-mails a code that confirms the address, and a
  password reset e-mails a code.
- After signing in on the web app, the browser holds `sessionid` and
  `csrftoken` for `pets.ampulla.tech`, and the API's calls carry them.
- `docker compose -f compose.prod.yml exec pets python manage.py send_reminders --date <day>`
  evaluates the reminders of that day by hand (it sends for real).

## Restoring

Into a scratch database, never over the live one:

```sh
docker compose -f compose.prod.yml exec backup /opt/backup/restore.sh latest pets_restore
```

It prints the row counts of the snapshot next to the restored data; compare
with `row-counts.txt` and the media manifest. To put the media back, copy the
restored `media/` directory into the bucket with `rclone copy` using the
read-write keys. Promoting a restored database is stopping `pets`, `worker`
and `cron`, renaming the databases, and starting them again.
