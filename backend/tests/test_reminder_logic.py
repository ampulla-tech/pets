"""The reminder as a pure function of the doses and the day (ADR-0003)."""

from datetime import date

import pytest

from reminders.logic import Dose, State, badge_for, milestone_on, reminders_for

RABIES = Dose("rabies", date(2026, 6, 6), date(2027, 6, 6), "vaccine", "r1")


@pytest.mark.parametrize(
    ("day", "state"),
    [
        (date(2026, 6, 6), State.SCHEDULED),
        (date(2027, 5, 29), State.SCHEDULED),
        (date(2027, 5, 30), State.UPCOMING),
        (date(2027, 6, 5), State.UPCOMING),
        (date(2027, 6, 6), State.DUE),
        (date(2027, 6, 7), State.OVERDUE),
        (date(2028, 1, 1), State.OVERDUE),
    ],
)
def test_the_state_follows_the_repeat_on_date(day, state):
    [reminder] = reminders_for([RABIES], day)
    assert (reminder.state, reminder.due_on) == (state, date(2027, 6, 6))


def test_a_later_dose_of_the_same_disease_closes_it():
    later = Dose("rabies", date(2027, 6, 10), date(2028, 6, 10), "vaccine", "r2")
    reminders = reminders_for([RABIES, later], date(2027, 6, 11))
    by_record = {r.source.record_id: r for r in reminders}
    assert by_record["r1"].state == State.CLOSED
    assert by_record["r1"].closed_by == later
    assert by_record["r2"].state == State.SCHEDULED


def test_a_combined_vaccine_closes_each_disease_it_covers():
    old = [
        Dose(d, date(2025, 7, 3), date(2025, 7, 24), "vaccine", "old")
        for d in ("rhinotracheitis", "calicivirus", "panleukopenia", "chlamydiosis", "felv")
    ]
    new = [
        Dose(d, date(2025, 7, 28), date(2026, 7, 28), "vaccine", "new")
        for d in ("rhinotracheitis", "calicivirus", "panleukopenia", "chlamydiosis", "felv")
    ]
    reminders = reminders_for(old + new, date(2025, 8, 1))
    assert {r.subject for r in reminders if r.state == State.CLOSED} == {
        "rhinotracheitis",
        "calicivirus",
        "panleukopenia",
        "chlamydiosis",
        "felv",
    }
    assert all(r.source.record_id == "new" for r in reminders if r.state != State.CLOSED)


def test_a_dose_of_another_disease_does_not_close_it():
    felv = Dose("felv", date(2027, 6, 10), None, "vaccine", "f1")
    reminders = reminders_for([RABIES, felv], date(2027, 6, 11))
    rabies = next(r for r in reminders if r.subject == "rabies")
    assert rabies.state == State.OVERDUE


def test_a_dose_without_repeat_on_opens_nothing_and_asks_for_a_date():
    dose = Dose("rabies", date(2026, 6, 6), None, "vaccine", "r1")
    [reminder] = reminders_for([dose], date(2026, 7, 1))
    assert (reminder.state, reminder.due_on) == (State.NO_DATE, None)


def test_a_later_dose_without_repeat_on_still_closes_the_earlier_one():
    later = Dose("rabies", date(2027, 6, 10), None, "vaccine", "r2")
    states = {r.source.record_id: r.state for r in reminders_for([RABIES, later], date(2027, 7, 1))}
    assert states == {"r1": State.CLOSED, "r2": State.NO_DATE}


def test_an_archived_animal_has_its_reminders_suspended():
    [reminder] = reminders_for([RABIES], date(2027, 6, 7), archived=True)
    assert reminder.state == State.SUSPENDED


@pytest.mark.parametrize(
    ("day", "milestone"),
    [
        (date(2027, 5, 29), None),
        (date(2027, 5, 30), "early"),
        (date(2027, 6, 5), "early"),
        (date(2027, 6, 6), "due"),
        (date(2027, 6, 12), "due"),
        (date(2027, 6, 13), "overdue-1"),
        (date(2027, 6, 20), "overdue-2"),
    ],
)
def test_the_milestones_are_a_week_before_the_day_and_weekly_after(day, milestone):
    assert milestone_on(date(2027, 6, 6), day) == milestone


def test_the_badge_says_overdue_due_soon_or_up_to_date():
    assert badge_for(reminders_for([RABIES], date(2027, 6, 7)), date(2027, 6, 7)).state == "overdue"
    soon = badge_for(reminders_for([RABIES], date(2027, 5, 20)), date(2027, 5, 20))
    assert (soon.state, soon.days) == ("due_soon", 17)
    assert badge_for(reminders_for([RABIES], date(2026, 7, 1)), date(2026, 7, 1)).state == (
        "up_to_date"
    )
    assert badge_for([], date(2026, 7, 1)).state == "none"


def test_the_badge_names_the_most_urgent_dose_and_counts_the_others():
    flea = Dose("external", date(2027, 5, 1), date(2027, 6, 1), "antiparasitic", "a1")
    worms = Dose("internal", date(2027, 5, 1), date(2027, 6, 20), "antiparasitic", "a2")
    day = date(2027, 6, 7)
    badge = badge_for(reminders_for([RABIES, flea, worms], day), day)
    assert (badge.state, badge.days, badge.kind, badge.others) == ("overdue", -6, "external", 2)
    soon = badge_for(reminders_for([RABIES, worms], date(2027, 6, 1)), date(2027, 6, 1))
    assert (soon.state, soon.days, soon.kind, soon.others) == ("due_soon", 5, "vaccine", 1)
