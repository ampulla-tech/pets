# Production runbook

Pets in production: the API at `https://api.pets.ampulla.tech` on the shared
VPS, and the web app at `https://pets.ampulla.tech` on Cloudflare Pages
(ADR-0008). On the VPS, the compose project in `compose.prod.yml` runs the
API, the photo-reading worker, the scheduled commands, Postgres and the nightly
backup, and publishes no port: the host's edge proxy reads the `caddy` labels
of the `pets` service on the `edge` network. Media lives in the private R2
bucket `ampulla-pets-media`; the nightly restic snapshot of the database and
the media goes to `ampulla-backup-pets`.

A merge to `main` deploys both: Backend CI pushes
`ghcr.io/ampulla-tech/pets` and `ghcr.io/ampulla-tech/pets-backup`, tagged
with the commit, and its `deploy` job runs `deploy.sh` on the host; Web CI
publishes `web/dist` to the Pages project `pets`. Each deploy is skipped with
a warning, and the run stays green, until its secrets exist.

## What lives elsewhere

The host and the cloud resources are the infra repository's
(`ampulla-tech/infra`), and its `vps/RUNBOOK.md` is the procedure for them:

- the VPS, Docker, the `deploy` user and its SSH key, and the host key the
  deploy job pins;
- the `edge` Docker network and the edge proxy (Caddy with
  caddy-docker-proxy, DNS-01 certificates);
- the host's `docker login ghcr.io` with a `read:packages` token, which these
  private images need;
- DNS `api.pets.ampulla.tech` to the VPS; the Pages project `pets` with the
  custom domain `pets.ampulla.tech`; the R2 buckets `ampulla-pets-media` and
  `ampulla-backup-pets`; the `ampulla.tech` sending domain in Resend.

## Secrets

Nothing below is ever written into the repository. Secrets are set in the
repository's GitHub environments (Settings, Environments): `vps` for the
backend deploy, `production` for the web deploy. Generated values are kept in
the password manager as well; `RESTIC_PASSWORD` must be, or no backup can ever
be read.

### `vps` (Backend CI, `deploy` job)

| Secret | What | Where it comes from |
|---|---|---|
| `VPS_HOST` | the VPS's address; while it is unset the deploy is skipped | infra's `vps/RUNBOOK.md` |
| `VPS_SSH_KEY` | the private key of the `deploy` user | infra's `vps/RUNBOOK.md` |
| `VPS_KNOWN_HOSTS` | the host key line(s), pinned (`ssh-keyscan` checked against the console) | infra's `vps/RUNBOOK.md` |
| `POSTGRES_PASSWORD` | the database password | generated: `openssl rand -hex 32` |
| `DJANGO_SECRET_KEY` | Django's signing key | generated: `openssl rand -base64 48 \| tr -d '\n='` |
| `RESTIC_PASSWORD` | the restic repository's password | generated: `openssl rand -base64 48 \| tr -d '\n='` |
| `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY` | the web push key pair, both one-line base64url | generated, below |
| `R2_ACCOUNT_ID` | the Cloudflare account that holds the buckets (the `<account>` of `https://<account>.r2.cloudflarestorage.com`) | by hand: Cloudflare dashboard, R2 overview |
| `R2_MEDIA_ACCESS_KEY_ID`, `R2_MEDIA_SECRET_ACCESS_KEY` | the API's key on `ampulla-pets-media`, Object Read & Write, that bucket only | by hand: R2, Manage API tokens |
| `R2_MEDIA_READ_ACCESS_KEY_ID`, `R2_MEDIA_READ_SECRET_ACCESS_KEY` | the backup's key on `ampulla-pets-media`, Object Read only, that bucket only | by hand: R2, Manage API tokens |
| `R2_RESTIC_ACCESS_KEY_ID`, `R2_RESTIC_SECRET_ACCESS_KEY` | restic's key on `ampulla-backup-pets`, Object Read & Write, that bucket only | by hand: R2, Manage API tokens |
| `RESEND_API_KEY` | Resend, sending access, domain `ampulla.tech` | by hand: Resend dashboard, API keys |
| `OPENROUTER_API_KEY` | the photo reading's key | by hand: OpenRouter dashboard, Keys |
| `BACKUP_PING_URL` | optional: a heartbeat URL pinged after each backup | by hand, from the monitor; may stay unset |

GHCR needs no secret here: the `ghcr` job pushes with the run's own
`GITHUB_TOKEN`, and the host pulls with its own login (above).

Not secrets, and kept in `compose.prod.yml`: the host names, the bucket names,
`DEFAULT_FROM_EMAIL=pets@ampulla.tech` and `INTAKE_MODEL` (ADR-0007).

The VAPID pair, generated with the API image (the private key is its raw 32
bytes: pywebpush does not read a PEM given as a string):

```sh
docker run --rm ghcr.io/ampulla-tech/pets:<sha> python -c "
from cryptography.hazmat.primitives import serialization as s
from py_vapid import Vapid
from py_vapid.utils import b64urlencode
v = Vapid(); v.generate_keys()
print('VAPID_PUBLIC_KEY=' + b64urlencode(v.public_key.public_bytes(s.Encoding.X962, s.PublicFormat.UncompressedPoint)))
print('VAPID_PRIVATE_KEY=' + b64urlencode(v.private_key.private_numbers().private_value.to_bytes(32, 'big')))"
```

Changing the pair later unsubscribes every browser that subscribed with the
old public key.

### `production` (Web CI, `deploy` job)

| Secret | What | Where it comes from |
|---|---|---|
| `CLOUDFLARE_PAGES_TOKEN` | an API token with Account, Cloudflare Pages, Edit, on this account only; while it is unset the publish is skipped | by hand: Cloudflare dashboard, API Tokens |
| `CLOUDFLARE_ACCOUNT_ID` | the account that holds the Pages project `pets` | by hand: Cloudflare dashboard (the same account as `R2_ACCOUNT_ID`) |

The web build's API host is public and committed: `web/.env.production`.

## On the host

The deploy directory is `/home/deploy/pets`, owned by `deploy`. The deploy
job copies `compose.prod.yml` and `deploy.sh` into `pets/release/` and runs
`bash pets/release/deploy.sh <sha>` with the secrets on stdin. `deploy.sh`
writes, mode 0600:

- `.env`: `COMPOSE_FILE`, `IMAGE_TAG`, `GHCR_OWNER`, `POSTGRES_PASSWORD`,
  `R2_ACCOUNT_ID`, read by Compose;
- `.env.pets`: `DJANGO_SECRET_KEY`, `AWS_ACCESS_KEY_ID` and
  `AWS_SECRET_ACCESS_KEY` (the media read-write key), `RESEND_API_KEY`,
  `OPENROUTER_API_KEY`, `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, for the API,
  the worker and cron;
- `.env.backup`: `RESTIC_PASSWORD`, `RESTIC_AWS_ACCESS_KEY_ID` and
  `RESTIC_AWS_SECRET_ACCESS_KEY`, `MEDIA_S3_ACCESS_KEY_ID` and
  `MEDIA_S3_SECRET_ACCESS_KEY` (the media read-only key), `BACKUP_PING_URL`
  when set, for the backup only;

and keeps the running release in `previous/`. It migrates on the new tag
before anything is recreated (a failed migration leaves the running version
up), recreates the services, asks `/health` from inside the API container,
and goes back to the previous tag if it does not answer 200; the job is red
whenever the new tag did not stay up. Every command below runs in
`/home/deploy/pets`, where `.env` names the compose file, so
`docker compose` needs no `-f`.

## First deploy

1. Infra's `vps/RUNBOOK.md` is done for this app: `ssh deploy@<host>` works,
   `docker network inspect edge` answers, `docker login ghcr.io` is in place,
   DNS, the Pages project and both buckets exist.
2. Create the R2 keys and the other secrets above, and set them in the `vps`
   and `production` environments.
3. Run Backend CI on `main` again (re-run the last push's run). The deploy
   job writes the files, starts Postgres on its empty volume, migrates and
   starts everything. Run Web CI on `main` (workflow dispatch) to publish the
   web app.
4. On the host, initialise the restic repository once (`backup.sh` never does,
   so a wrong repository fails instead of starting an empty one elsewhere):

   ```sh
   docker compose exec backup sh -c 'export AWS_ACCESS_KEY_ID="$RESTIC_AWS_ACCESS_KEY_ID" AWS_SECRET_ACCESS_KEY="$RESTIC_AWS_SECRET_ACCESS_KEY"; restic init'
   ```

5. Take the first backup now rather than at 03:30:
   `docker compose exec backup /opt/backup/backup.sh`.
6. Run the checks and the restore test below.

## Checks

After the first deploy, and after any change to the host or the secrets:

1. **`/health` answers 200**:
   `curl -sS -o /dev/null -w '%{http_code}\n' https://api.pets.ampulla.tech/health`
   prints `200` (the body is `{"status": "ok"}`).
2. **The backup holds the database and the media**:

   ```sh
   docker compose exec backup sh -c 'export AWS_ACCESS_KEY_ID="$RESTIC_AWS_ACCESS_KEY_ID" AWS_SECRET_ACCESS_KEY="$RESTIC_AWS_SECRET_ACCESS_KEY"; restic snapshots --host pets-vps && restic ls latest /db /media | head'
   ```

   lists the night's snapshot of host `pets-vps`, tagged `nightly`, whose two
   paths end in `/db` and `/media`, then `/db/pets.dump`,
   `/db/row-counts.txt`, `/db/media-manifest.txt` and the media files.
3. **A password reset e-mail arrives**: on `https://pets.ampulla.tech/recuperar`,
   ask for a code for a real inbox with an account; the e-mail from
   `pets@ampulla.tech` arrives with the code, and the code resets the password.

Also worth a look after the first sign-in on the web app: the browser holds
`sessionid` and `csrftoken` for `pets.ampulla.tech`, and the API's calls carry
them (the deploy harness checks the same flow on every change).

## Restore test

Run after the first backup, and again every few months. It restores into a
scratch database, never over the live one (`restore.sh` refuses a database
that already holds tables):

```sh
docker compose exec backup /opt/backup/restore.sh latest pets_restore_test
```

It prints `database pets_restore_test: <n> tables, counts match` and
`media: <n> files under /tmp/restore.<x>/media, manifest matches`, and exits
non-zero on any difference from what the snapshot recorded. Then drop the
scratch database and the files:

```sh
docker compose exec backup sh -c 'dropdb pets_restore_test && rm -rf /tmp/restore.*'
```

The same round trip runs in CI against a MinIO (`backup/test.sh`).

## Restoring for real

1. Restore into a new database as in the test, with a name of the day
   (`pets_restored_<date>`), from `latest` or a snapshot id from
   `restic snapshots`.
2. Media, if the bucket lost files: copy the restored `media/` directory back
   into `ampulla-pets-media` with the **read-write** key (the backup container
   holds only the read-only one), e.g. from the backup container:

   ```sh
   RCLONE_CONFIG_M_TYPE=s3 RCLONE_CONFIG_M_PROVIDER=Cloudflare \
   RCLONE_CONFIG_M_ENDPOINT="$MEDIA_S3_ENDPOINT" \
   RCLONE_CONFIG_M_ACCESS_KEY_ID=<read-write key id> \
   RCLONE_CONFIG_M_SECRET_ACCESS_KEY=<read-write secret> \
   rclone copy /tmp/restore.<x>/media m:ampulla-pets-media
   ```

   typed at the prompt, never saved to a file.
3. Promote the database: `docker compose stop pets worker cron`, then in
   Postgres `ALTER DATABASE pets RENAME TO pets_broken_<date>` and
   `ALTER DATABASE pets_restored_<date> RENAME TO pets` (from the `postgres`
   database, `docker compose exec postgres psql -U pets -d postgres`), then
   `docker compose up -d`, and the checks above.

## Rolling back by hand

`previous/` holds the release before the last deploy. To run an older tag,
re-run that commit's Backend CI run on `main`, or on the host:
`cp previous/.env previous/.env.pets previous/.env.backup previous/compose.prod.yml . && docker compose up -d`.
Migrations are additive, so an older tag runs on the newer schema.

## By hand on the host

- Reminders of a given day, sent for real:
  `docker compose exec pets python manage.py send_reminders --date <day>`.
- Logs: `docker compose logs -f pets worker cron backup`.
