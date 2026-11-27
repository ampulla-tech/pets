"""A calendar month as the API carries it: "2027-09" (ADR-0010).

The lot expiry printed on a vaccine label is a month, so it is stored and
exchanged as YYYY-MM, or empty when there is none. Every way in checks it with
the rule below, and only here.
"""

import re

MONTH = r"[0-9]{4}-(?:0[1-9]|1[0-2])"
"""YYYY-MM, with a month from 01 to 12."""

MONTH_OR_EMPTY = rf"^(?:{MONTH})?$"
"""The pattern of a field that holds a month or nothing."""

_MONTH = re.compile(MONTH)


def is_month(value: str) -> bool:
    """Whether the text is a month as the API carries it ("2027-09")."""
    return _MONTH.fullmatch(value) is not None
