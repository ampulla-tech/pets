"""The guest role: reads everything, writes weights and notes, and the access ends."""

from datetime import date, timedelta

import pytest
from django.utils import timezone

from animals.access import tutors_of
from animals.models import Access, Animal
from conftest import CAT, jpeg_file, make_animal
from tests.test_people import invite
from tests.test_records import DRONTAL, RABMUNE


@pytest.fixture
def setup(tutor, other):
    cat = make_animal(tutor, CAT)
    other.post(f"/invites/{invite(tutor, cat['id'], 'guest')['token']}/accept")
    vaccine = tutor.post(f"/animals/{cat['id']}/vaccines", RABMUNE).json()
    return cat, vaccine


def test_a_guest_reads_the_profile_history_and_files(setup, other):
    cat, _ = setup
    assert other.get(f"/animals/{cat['id']}").json()["role"] == "guest"
    assert len(other.get(f"/animals/{cat['id']}/records").json()) == 1
    assert other.get(f"/animals/{cat['id']}/card").status_code == 200
    assert other.get(f"/animals/{cat['id']}/accesses").status_code == 200


def test_a_guest_writes_weights_and_notes(setup, other):
    cat, _ = setup
    assert (
        other.post(f"/animals/{cat['id']}/weights", {"date": "2026-10-30", "kg": "4.9"}).status_code
        == 201
    )
    assert (
        other.post(
            f"/animals/{cat['id']}/notes", {"date": "2026-10-30", "text": "Dormiu bem."}
        ).status_code
        == 201
    )


@pytest.mark.parametrize(
    ("method", "path", "body"),
    [
        ("post", "vaccines", RABMUNE),
        ("post", "antiparasitics", DRONTAL),
        ("post", "visits", {"date": "2026-10-30"}),
        ("post", "invites", {"role": "guest"}),
        ("post", "archive", {"reason": "other", "on": "2026-10-30"}),
        ("put", "", CAT),
        ("delete", "", None),
    ],
)
def test_a_guest_does_nothing_else(setup, other, method, path, body):
    cat, _ = setup
    url = f"/animals/{cat['id']}" + (f"/{path}" if path else "")
    response = getattr(other, method)(url, body) if body is not None else other.delete(url)
    assert response.status_code == 403


def test_a_guest_does_not_edit_or_delete_a_vaccine(setup, other):
    cat, vaccine = setup
    path = f"/animals/{cat['id']}/vaccines/{vaccine['id']}"
    assert other.put(path, RABMUNE).status_code == 403
    assert other.delete(path).status_code == 403


def test_a_guest_does_not_upload_files_or_read_photos(setup, other):
    cat, _ = setup
    assert other.upload(f"/animals/{cat['id']}/attachments", [jpeg_file()]).status_code == 403
    assert other.upload(f"/animals/{cat['id']}/extractions", [jpeg_file()]).status_code == 403


def test_a_guest_does_not_remove_others(setup, other):
    cat, _ = setup
    tutor_access = Access.objects.get(user__email="tutor@example.com")
    assert other.delete(f"/animals/{cat['id']}/accesses/{tutor_access.id}").status_code == 403


def test_the_guest_edits_only_their_own_weight(setup, tutor, other):
    cat, _ = setup
    mine = tutor.post(f"/animals/{cat['id']}/weights", {"date": "2026-10-29", "kg": "4.8"}).json()
    theirs = other.post(f"/animals/{cat['id']}/weights", {"date": "2026-10-30", "kg": "4.9"}).json()
    assert theirs["can_edit"] is True
    path = f"/animals/{cat['id']}/weights"
    assert other.put(f"{path}/{theirs['id']}", {"date": "2026-10-30", "kg": "5"}).status_code == 200
    assert other.put(f"{path}/{mine['id']}", {"date": "2026-10-29", "kg": "5"}).status_code == 403


def test_the_access_ends_the_day_after_its_end_with_no_job(setup, other):
    cat, _ = setup
    today = timezone.localdate()
    Access.objects.filter(user__email="other@example.com").update(ends_on=today)
    assert other.get(f"/animals/{cat['id']}").status_code == 200
    Access.objects.filter(user__email="other@example.com").update(ends_on=today - timedelta(days=1))
    assert other.get(f"/animals/{cat['id']}").status_code == 404
    assert other.get("/animals").json() == []


def test_a_guest_is_never_a_reminder_recipient(setup):
    animal = Animal.objects.get()
    assert [u.email for u in tutors_of(animal)] == ["tutor@example.com"]


def test_an_expired_guest_can_be_invited_again(setup, tutor, other):
    cat, _ = setup
    Access.objects.filter(user__email="other@example.com").update(ends_on=date(2020, 1, 1))
    created = invite(tutor, cat["id"], "guest")
    assert other.post(f"/invites/{created['token']}/accept").status_code == 200
