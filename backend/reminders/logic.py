"""The reminder, derived from the records and never typed (ADR-0003).

For each subject of an animal (a disease a vaccine covers, or a kind of
antiparasitic) every dose that carries a "repeat on" date opens a reminder for
that date. A later dose of the same subject closes it. The app never computes a
protocol: a dose with no "repeat on" opens nothing, and when it is the latest
dose of its subject the subject shows "no date" until someone sets one.

These functions are pure: doses and a day in, reminders out.
"""

from dataclasses import dataclass
from datetime import date, timedelta
from enum import StrEnum

EARLY_NOTICE = timedelta(days=7)
OVERDUE_EVERY = timedelta(days=7)
UPCOMING_WINDOW = timedelta(days=30)


class State(StrEnum):
    NO_DATE = "no_date"
    SCHEDULED = "scheduled"
    UPCOMING = "upcoming"
    DUE = "due"
    OVERDUE = "overdue"
    CLOSED = "closed"
    SUSPENDED = "suspended"


OPEN_STATES = {State.SCHEDULED, State.UPCOMING, State.DUE, State.OVERDUE}


@dataclass(frozen=True)
class Dose:
    """One dose of one subject: a record seen through one disease it covers."""

    subject: str
    date: date
    repeat_on: date | None
    record_kind: str
    record_id: str
    # Records of one day keep their order of entry.
    sequence: float = 0.0
    # The vaccine's brand or the antiparasitic's product, as written.
    product: str = ""


@dataclass(frozen=True)
class Reminder:
    subject: str
    state: State
    due_on: date | None
    source: Dose
    closed_by: Dose | None = None

    @property
    def key(self) -> str:
        """What identifies this reminder for the sending log: a change of its
        date or of the dose behind it is a new reminder."""
        return (
            f"{self.subject}:{self.source.record_kind}:{self.source.record_id}:"
            f"{self.due_on.isoformat() if self.due_on else '-'}"
        )


def state_on(due_on: date, today: date) -> State:
    if today > due_on:
        return State.OVERDUE
    if today == due_on:
        return State.DUE
    if today >= due_on - EARLY_NOTICE:
        return State.UPCOMING
    return State.SCHEDULED


def reminders_for(doses: list[Dose], today: date, archived: bool = False) -> list[Reminder]:
    """Every reminder of one animal, open and closed, by subject.

    Each dose with a "repeat on" yields a reminder: closed when a later dose of
    the same subject exists, open otherwise (suspended when the animal is
    archived). The latest dose of a subject with no "repeat on" yields a
    "no date" entry, with no due day.
    """
    by_subject: dict[str, list[Dose]] = {}
    for dose in doses:
        by_subject.setdefault(dose.subject, []).append(dose)

    result: list[Reminder] = []
    for subject, subject_doses in by_subject.items():
        ordered = sorted(subject_doses, key=lambda d: (d.date, d.sequence))
        latest = ordered[-1]
        for index, dose in enumerate(ordered):
            later = next((d for d in ordered[index + 1 :] if d.date > dose.date), None)
            if dose is not latest and later is None:
                # Same day as the latest dose: the latest one speaks for both.
                later = latest
            if dose.repeat_on is None:
                if dose is latest:
                    state = State.SUSPENDED if archived else State.NO_DATE
                    result.append(Reminder(subject, state, None, dose))
                continue
            if later is not None:
                result.append(Reminder(subject, State.CLOSED, dose.repeat_on, dose, later))
            elif archived:
                result.append(Reminder(subject, State.SUSPENDED, dose.repeat_on, dose))
            else:
                result.append(
                    Reminder(subject, state_on(dose.repeat_on, today), dose.repeat_on, dose)
                )
    return result


def open_reminders(reminders: list[Reminder]) -> list[Reminder]:
    return [r for r in reminders if r.state in OPEN_STATES]


def milestone_on(due_on: date, today: date) -> str | None:
    """The notice a reminder owes on a day: the latest milestone reached.

    Seven days before ("early"), on the day ("due"), and every seven days while
    overdue ("overdue-1", "overdue-2", ...). A day the job did not run is caught
    up by the next run, and the sending log keeps each milestone to one send.
    """
    if today < due_on - EARLY_NOTICE:
        return None
    if today < due_on:
        return "early"
    weeks = (today - due_on) // OVERDUE_EVERY
    return "due" if weeks == 0 else f"overdue-{weeks}"


@dataclass(frozen=True)
class Badge:
    """The one-glance state of an animal on its card."""

    state: str  # "none" | "up_to_date" | "due_soon" | "overdue"
    days: int | None = None


def badge_for(reminders: list[Reminder], today: date) -> Badge:
    open_ = open_reminders(reminders)
    if not open_ and not any(r.state == State.CLOSED for r in reminders):
        return Badge("none")
    if any(r.state == State.OVERDUE for r in open_):
        return Badge("overdue")
    soon = [r for r in open_ if r.due_on and r.due_on - today <= UPCOMING_WINDOW]
    if soon:
        return Badge("due_soon", min((r.due_on - today).days for r in soon))
    return Badge("up_to_date")


def is_upcoming(reminder: Reminder, today: date) -> bool:
    """Whether a reminder belongs in "next up": overdue, or due within 30 days."""
    return (
        reminder.state in OPEN_STATES
        and reminder.due_on is not None
        and reminder.due_on - today <= UPCOMING_WINDOW
    )
