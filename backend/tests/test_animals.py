"""Registering an animal, its age, its photo, and who can see it."""

from datetime import date

import pytest

from animals.age import Age, age_of
from conftest import CAT, DOG, jpeg_file, make_animal


@pytest.mark.parametrize(
    ("precision", "birth", "expected"),
    [
        ("exact", date(2026, 9, 1), Age(0, 1, False)),
        ("exact", date(2024, 10, 31), Age(2, 0, False)),
        ("month", date(2025, 3, 1), Age(1, 7, True)),
        ("year", date(2022, 1, 1), Age(4, None, True)),
        ("unknown", None, None),
    ],
)
def test_the_age_follows_what_is_known_of_the_birth(precision, birth, expected):
    assert age_of(precision, birth, date(2026, 10, 31)) == expected


def test_registering_makes_the_person_its_first_tutor(tutor):
    body = {**DOG, "birth": {"precision": "month", "value": "2025-03"}}
    animal = make_animal(tutor, body)
    assert animal["role"] == "tutor"
    assert animal["birth"] == {"precision": "month", "value": "2025-03"}
    assert animal["age"]["approximate"] is True
    assert animal["badge"]["state"] == "none"


def test_an_unknown_birth_has_no_age(tutor):
    animal = make_animal(tutor, CAT)
    assert animal["age"] is None


def test_a_birth_value_must_match_its_precision(tutor):
    body = {**DOG, "birth": {"precision": "month", "value": "2025"}}
    assert tutor.post("/animals", body).status_code == 422


def test_the_home_lists_the_active_animals(tutor):
    make_animal(tutor, DOG)
    make_animal(tutor, CAT)
    names = [a["name"] for a in tutor.get("/animals").json()]
    assert names == ["Bug", "Lacan"]


def test_someone_without_access_does_not_see_or_edit_it(tutor, other):
    animal = make_animal(tutor)
    assert other.get(f"/animals/{animal['id']}").status_code == 404
    assert other.put(f"/animals/{animal['id']}", DOG).status_code == 404
    assert other.get("/animals").json() == []


def test_the_profile_is_edited(tutor):
    animal = make_animal(tutor)
    body = {**DOG, "neutered": True, "adopted_on": "2026-10-10", "coat": "Preto"}
    updated = tutor.put(f"/animals/{animal['id']}", body).json()
    assert updated["neutered"] is True
    assert updated["adopted_on"] == "2026-10-10"
    assert updated["coat"] == "Preto"


def test_the_photo_is_stored_and_served_by_a_signed_link(tutor):
    animal = make_animal(tutor)
    response = tutor.upload(f"/animals/{animal['id']}/photo", jpeg_file(), field="file")
    assert response.status_code == 200
    url = response.json()["photo_url"]
    served = tutor.client.get(url.replace("http://testserver", ""))
    assert served.status_code == 200
    assert served["Content-Type"] == "image/jpeg"


def test_a_tampered_file_link_is_not_found(tutor):
    animal = make_animal(tutor)
    url = tutor.upload(f"/animals/{animal['id']}/photo", jpeg_file(), field="file").json()[
        "photo_url"
    ]
    assert tutor.client.get(url.replace("http://testserver", "") + "x").status_code == 404
