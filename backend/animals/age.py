"""An animal's age, from whatever is known of its birth.

Exact birth: years and months, exact. A month: years and months, approximate.
Only a year: whole years, approximate. Unknown: no age at all.
"""

from dataclasses import dataclass
from datetime import date


@dataclass(frozen=True)
class Age:
    years: int
    months: int | None
    approximate: bool


def _months_between(start: date, end: date) -> int:
    months = (end.year - start.year) * 12 + (end.month - start.month)
    if end.day < start.day:
        months -= 1
    return max(months, 0)


def age_of(precision: str, birth: date | None, today: date) -> Age | None:
    if birth is None or precision == "unknown":
        return None
    if precision == "year":
        return Age(years=max(today.year - birth.year, 0), months=None, approximate=True)
    if precision == "month":
        birth = birth.replace(day=1)
        today = today.replace(day=1)
    total = _months_between(birth, today)
    return Age(years=total // 12, months=total % 12, approximate=precision != "exact")
