"""Every lot expiry already stored becomes YYYY-MM (ADR-0010).

"09/2027", "9/2027" and "2027-9" are converted. Any other text is not guessed
at: the migration fails and names each vaccine and its value, nothing is
changed, and the deploy keeps the release that is running. Those few are put
right by hand and the deploy is run again.
"""

import re

from django.db import migrations

_YYYY_MM = re.compile(r"[0-9]{4}-(?:0[1-9]|1[0-2])")
_MM_YYYY = re.compile(r"([0-9]{1,2})/([0-9]{4})")
_YYYY_M = re.compile(r"([0-9]{4})-([0-9]{1,2})")


def as_month(text: str) -> str | None:
    """The text as YYYY-MM, or None when it is not a month written one of the known ways."""
    value = text.strip()
    if _YYYY_MM.fullmatch(value):
        return value
    if match := _MM_YYYY.fullmatch(value):
        month, year = int(match[1]), match[2]
    elif match := _YYYY_M.fullmatch(value):
        year, month = match[1], int(match[2])
    else:
        return None
    return f"{year}-{month:02d}" if 1 <= month <= 12 else None


def forward(apps, schema_editor):
    Vaccine = apps.get_model("animals", "Vaccine")
    changed, unconvertible = [], []
    for vaccine in Vaccine.objects.exclude(lot_expiry="").only("id", "lot_expiry"):
        month = as_month(vaccine.lot_expiry)
        if month is None:
            unconvertible.append(vaccine)
        elif month != vaccine.lot_expiry:
            vaccine.lot_expiry = month
            changed.append(vaccine)
    if unconvertible:
        lines = "\n".join(f"  {v.id} {v.lot_expiry!r}" for v in unconvertible)
        raise RuntimeError(f"lot_expiry not convertible to YYYY-MM:\n{lines}")
    Vaccine.objects.bulk_update(changed, ["lot_expiry"])


class Migration(migrations.Migration):
    dependencies = [("animals", "0001_initial")]

    operations = [migrations.RunPython(forward, migrations.RunPython.noop)]
