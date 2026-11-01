# backup

The image the VPS runs beside the API (`backend/deploy/compose.prod.yml`):
every night at 03:30 Brasília time, `backup.sh` dumps the database, copies the
media bucket (the label photos are the only proof of a dose, so the media is
backed up, not only the database), and writes both into one restic snapshot,
keeping 30 daily and 12 monthly snapshots. `restore.sh` restores a snapshot
into a scratch database. The procedures are in
[`backend/deploy/RUNBOOK.md`](../backend/deploy/RUNBOOK.md).
