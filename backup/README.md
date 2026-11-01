# backup

The image the VPS runs beside the API (`backend/deploy/compose.prod.yml`):
every night at 03:30 Brasília time, `backup.sh` dumps the database and counts
its rows in the same database snapshot, copies the media bucket
`ampulla-pets-media` with a read-only key (the label photos are the only proof
of a dose, so the media is backed up, not only the database), and writes both
into one restic snapshot in `ampulla-backup-pets`, keeping 30 daily and 12
monthly snapshots. `restore.sh` restores a snapshot into a new database and a
scratch directory and checks both against the counts and the media manifest
the snapshot recorded.

`test.sh` runs the backup and the restore end to end against a MinIO, with no
cloud account; CI runs it on every change. The procedures are in
[`backend/deploy/RUNBOOK.md`](../backend/deploy/RUNBOOK.md).
