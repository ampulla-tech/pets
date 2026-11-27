"""The notice list, read and unread, as the app asks for them (ADR-0009)."""

from datetime import date

import pytest

from conftest import CAT, LABEL, make_animal, signup
from reminders import dispatch
from reminders.models import Notice
from tests.test_people import invite


@pytest.fixture
def told(tutor, other):
    """Lacan's rabies, due on 2027-06-06, told to two tutors on the day."""
    cat = make_animal(tutor, {**CAT, "name": "Paçoca", "sex": "female"})
    other.post(f"/invites/{invite(tutor, cat['id'])['token']}/accept")
    tutor.post(
        f"/animals/{cat['id']}/vaccines",
        {
            **LABEL,
            "date": "2026-06-06",
            "brand": "Vanguard Plus",
            "diseases": ["rabies"],
            "repeat_on": "2027-06-06",
        },
    )
    dispatch.run(date(2027, 6, 6))
    return cat


def test_the_list_is_the_callers_notices_with_their_words(tutor, told):
    [notice] = tutor.get("/notices").json()
    assert notice["animal_id"] == told["id"]
    assert notice["animal_name"] == "Paçoca"
    assert notice["title"] == "Hoje é dia de vacinar a Paçoca."
    assert notice["body"] == "Vanguard Plus"
    assert notice["url"] == f"/animais/{told['id']}?assunto=rabies"
    assert notice["read"] is False
    assert notice["sent_at"]


def test_listing_marks_nothing_read(tutor, told):
    tutor.get("/notices")
    assert tutor.get("/notices/unread").json() == {"unread": True}


def test_reading_one_notice_is_the_callers_only_and_holds_everywhere(tutor, other, told):
    [notice] = tutor.get("/notices").json()
    assert tutor.post(f"/notices/{notice['id']}/read").status_code == 204
    assert tutor.get("/notices").json()[0]["read"] is True
    assert tutor.get("/notices/unread").json() == {"unread": False}
    # The other tutor's own notice is untouched, and theirs is not the tutor's.
    assert other.get("/notices/unread").json() == {"unread": True}
    [others] = other.get("/notices").json()
    assert tutor.post(f"/notices/{others['id']}/read").status_code == 404


def test_reading_all_clears_the_dot(tutor, told):
    assert tutor.post("/notices/read").status_code == 204
    assert tutor.get("/notices/unread").json() == {"unread": False}
    assert all(n["read"] for n in tutor.get("/notices").json())


def test_a_notice_about_an_animal_one_left_is_not_listed(tutor, other, told):
    from animals.models import Access

    mine = Access.objects.get(user__email="other@example.com")
    assert other.delete(f"/animals/{told['id']}/accesses/{mine.id}").status_code == 204
    assert other.get("/notices").json() == []
    assert other.get("/notices/unread").json() == {"unread": False}


def test_a_guest_has_no_notices(tutor, told):
    guest = signup("guest@example.com")
    guest.post(f"/invites/{invite(tutor, told['id'], 'guest')['token']}/accept")
    assert guest.get("/notices").json() == []


def test_the_list_holds_the_latest_fifty_newest_first(tutor, told):
    notice = Notice.objects.filter(user__email="tutor@example.com").get()
    for n in range(60):
        Notice.objects.create(
            user=notice.user, animal=notice.animal, day=notice.day, title=f"#{n}", path="/"
        )
    titles = [n["title"] for n in tutor.get("/notices").json()]
    assert len(titles) == 50
    assert titles[0] == "#59"
