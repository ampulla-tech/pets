"""Reminders as the app shows them: next up, the badge, an animal's subjects.

The fixture is the three cards' dates and diseases as of 2026-10-31.
"""

from datetime import date

import pytest

from conftest import CAT, DOG, make_animal

DHPPI_L = ["distemper", "infectious_hepatitis", "parvovirus", "parainfluenza", "leptospirosis"]


@pytest.fixture
def cards(tutor, today):
    today(date(2026, 10, 31))
    dog = make_animal(tutor, DOG)
    cat = make_animal(tutor, CAT)
    vaccines = [
        (dog, "2026-10-16", "Nobivac DHPPi+L", DHPPI_L, "2026-11-06"),
        (
            cat,
            "2026-05-18",
            "Felocell CVR-C",
            ["rhinotracheitis", "calicivirus", "panleukopenia", "chlamydiosis"],
            "2026-06-08",
        ),
        (
            cat,
            "2026-06-06",
            "Felocell CVR-C",
            ["rhinotracheitis", "calicivirus", "panleukopenia", "chlamydiosis"],
            "2027-06-06",
        ),
        (cat, "2026-06-06", "Bioraiva Pet", ["rabies"], "2027-06-06"),
        (cat, "2026-10-05", "Felocell FeLV", ["felv"], "2026-10-26"),
        (cat, "2026-10-27", "Felocell FeLV", ["felv"], "2027-10-27"),
    ]
    for animal, day, brand, diseases, repeat in vaccines:
        response = tutor.post(
            f"/animals/{animal['id']}/vaccines",
            {
                "date": day,
                "brand": brand,
                "diseases": diseases,
                "repeat_on": repeat,
            },
        )
        assert response.status_code == 201
    for day, repeat in (("2026-10-13", "2026-10-21"), ("2026-10-22", "2026-10-23")):
        tutor.post(
            f"/animals/{dog['id']}/antiparasitics",
            {
                "date": day,
                "parasite": "internal",
                "product": "Drontal",
                "dose": "1 mL",
                "repeat_on": repeat,
            },
        )
    return dog, cat


def test_next_up_has_the_dhppi_l_due_on_the_sixth(tutor, cards):
    upcoming = tutor.get("/reminders/upcoming").json()
    subjects = [(r["animal_name"], r["subject"], r["due_on"], r["state"]) for r in upcoming]
    assert ("Bug", "internal", "2026-10-23", "overdue") in subjects
    for disease in DHPPI_L:
        assert ("Bug", disease, "2026-11-06", "upcoming") in subjects
    assert all(r["animal_name"] != "Lacan" for r in upcoming)
    assert [r["due_on"] for r in upcoming] == sorted(r["due_on"] for r in upcoming)


def test_the_felv_booster_is_closed_by_the_dose_of_the_27th(tutor, cards):
    _, cat = cards
    reminders = tutor.get(f"/animals/{cat['id']}/reminders").json()
    felv = [(r["state"], r["due_on"]) for r in reminders if r["subject"] == "felv"]
    assert sorted(felv) == [("closed", "2026-10-26"), ("scheduled", "2027-10-27")]


def test_the_cards_carry_the_badge(tutor, cards):
    animals = {a["name"]: a["badge"] for a in tutor.get("/animals").json()}
    assert animals["Bug"] == {"state": "overdue", "days": None}
    assert animals["Lacan"] == {"state": "up_to_date", "days": None}


def test_no_reminder_is_computed_without_repeat_on(tutor, today):
    today(date(2026, 10, 31))
    cat = make_animal(tutor, CAT)
    tutor.post(f"/animals/{cat['id']}/vaccines", {"date": "2026-10-05", "diseases": ["rabies"]})
    [reminder] = tutor.get(f"/animals/{cat['id']}/reminders").json()
    assert (reminder["state"], reminder["due_on"]) == ("no_date", None)
    assert tutor.get("/reminders/upcoming").json() == []


def test_an_archived_animal_leaves_next_up(tutor, cards):
    dog, _ = cards
    tutor.post(f"/animals/{dog['id']}/archive", {"reason": "died", "on": "2026-10-31"})
    assert tutor.get("/reminders/upcoming").json() == []
    assert [a["name"] for a in tutor.get("/animals").json()] == ["Lacan"]
    archived = tutor.get("/animals?status=archived").json()
    assert [(a["name"], a["archived_reason"]) for a in archived] == [("Bug", "died")]
    states = {r["state"] for r in tutor.get(f"/animals/{dog['id']}/reminders").json()}
    assert states <= {"suspended", "closed"}


def test_an_archived_animal_is_read_only(tutor, cards):
    dog, _ = cards
    tutor.post(f"/animals/{dog['id']}/archive", {"reason": "died", "on": "2026-10-31"})
    response = tutor.post(f"/animals/{dog['id']}/notes", {"date": "2026-10-31", "text": "x"})
    assert response.status_code == 409
    assert len(tutor.get(f"/animals/{dog['id']}/records").json()) == 3
