"""The words of a notice: what to do and with whom, then the product (ADR-0009)."""

from datetime import date, timedelta

import pytest

from reminders.logic import Dose, Reminder, State
from reminders.wording import word

TODAY = date(2026, 11, 6)


def reminder(subject, kind="vaccine", product="", due=TODAY, record="r1"):
    dose = Dose(subject, due - timedelta(days=365), due, kind, record, product=product)
    return Reminder(subject, State.DUE, due, dose)


def vaccine(product="Vanguard Plus", due=TODAY, record="v1", subject="distemper"):
    return reminder(subject, "vaccine", product, due, record)


def dewormer(product="Drontal", due=TODAY):
    return reminder("internal", "antiparasitic", product, due, "a1")


def flea(product="NexGard", due=TODAY):
    return reminder("external", "antiparasitic", product, due, "a2")


def early(r):
    return [(r, "early")]


IN_7 = TODAY + timedelta(days=7)
LATE_7 = TODAY - timedelta(days=7)


@pytest.mark.parametrize(
    ("name", "sex", "items", "title", "body"),
    [
        (
            "Paçoca",
            "female",
            [(vaccine(), "due")],
            "Hoje é dia de vacinar a Paçoca.",
            "Vanguard Plus",
        ),
        (
            "Paçoca",
            "female",
            early(vaccine(due=IN_7)),
            "A vacina da Paçoca vence em 7 dias.",
            "Já agendou? Vanguard Plus.",
        ),
        (
            "Paçoca",
            "female",
            [(vaccine(due=LATE_7), "overdue-1")],
            "A vacina da Paçoca está atrasada há 7 dias.",
            "Vanguard Plus · venceu em 30/10",
        ),
        (
            "Thor",
            "male",
            [(dewormer(), "due")],
            "Hoje é dia de dar o vermífugo do Thor.",
            "Drontal",
        ),
        (
            "Mel",
            "female",
            early(flea(due=IN_7)),
            "O antipulgas da Mel vence em 7 dias.",
            "NexGard",
        ),
        (
            "Thor",
            "male",
            [(vaccine(), "due"), (dewormer(), "due")],
            "Hoje é dia de vacinar e dar o vermífugo do Thor.",
            "Vanguard Plus · Drontal",
        ),
        (
            "Paçoca",
            "",
            [(vaccine(product=""), "due")],
            "Hoje é dia de vacinar Paçoca.",
            "",
        ),
    ],
)
def test_the_table_of_the_spec(name, sex, items, title, body):
    wording = word(name, sex, items, TODAY)
    assert (wording.title, wording.body) == (title, body)


def test_one_day_ahead_is_tomorrow():
    wording = word("Thor", "male", early(dewormer(due=TODAY + timedelta(days=1))), TODAY)
    assert wording.title == "O vermífugo do Thor vence amanhã."
    assert wording.body == "Drontal"


def test_the_diseases_of_one_dose_are_one_vaccine():
    items = [(vaccine(subject=s), "due") for s in ("distemper", "parvovirus", "leptospirosis")]
    wording = word("Paçoca", "female", items, TODAY)
    assert (wording.title, wording.body) == ("Hoje é dia de vacinar a Paçoca.", "Vanguard Plus")


def test_several_kinds_overdue_together_are_plural():
    items = [(vaccine(due=LATE_7), "overdue-1"), (dewormer(due=LATE_7), "overdue-1")]
    wording = word("Thor", "male", items, TODAY)
    assert wording.title == "A vacina e o vermífugo do Thor estão atrasados há 7 dias."
    assert wording.body == "Vanguard Plus · Drontal · venceu em 30/10"


def test_the_most_urgent_is_the_title_and_the_other_is_the_second_line():
    items = [(dewormer(due=IN_7), "early"), (vaccine(due=LATE_7), "overdue-1")]
    wording = word("Thor", "male", items, TODAY)
    assert wording.title == "A vacina do Thor está atrasada há 7 dias."
    assert wording.body == "O vermífugo do Thor vence em 7 dias."


def test_a_notice_caught_up_late_says_it_is_late():
    wording = word("Thor", "male", [(dewormer(due=TODAY - timedelta(days=1)), "due")], TODAY)
    assert wording.title == "O vermífugo do Thor está atrasado há 1 dia."
    assert wording.body == "Drontal · venceu em 05/11"


def test_an_overdue_dose_with_no_product_says_when_it_fell_due():
    wording = word("Mel", "female", [(flea(product="", due=LATE_7), "overdue-1")], TODAY)
    assert wording.body == "Venceu em 30/10"
