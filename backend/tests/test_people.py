"""Sharing an animal: invites, the access list, removing and leaving (ADR-0006)."""

from datetime import timedelta

from django.utils import timezone

from animals.models import Access, Animal, Invite
from conftest import BROWSER, PASSWORD, Api, Browser, last_code, make_animal, signup


def invite(api: Api, animal_id, role="tutor", ends=None):
    response = api.post(f"/animals/{animal_id}/invites", {"role": role, "access_ends_on": ends})
    assert response.status_code == 201, response.content
    return response.json()


def test_an_invite_is_a_link_valid_for_three_days(tutor):
    dog = make_animal(tutor)
    created = invite(tutor, dog["id"])
    assert created["url"].endswith(f"/convite/{created['token']}")
    stored = Invite.objects.get(token=created["token"])
    assert stored.expires_at - stored.created_at == timedelta(days=3)


def test_the_invite_screen_shows_who_invited_the_animal_and_the_role_with_no_account(tutor):
    dog = make_animal(tutor)
    created = invite(tutor, dog["id"], role="guest", ends="2030-01-10")
    preview = Api().get(f"/invites/{created['token']}")
    assert preview.status_code == 200
    body = preview.json()
    assert body["state"] == "valid"
    assert body["invited_by"] == "tutor@example.com"
    assert body["animal"]["name"] == "Bug"
    assert (body["role"], body["access_ends_on"]) == ("guest", "2030-01-10")
    assert body["already_member"] is False


def test_accepting_creates_the_access_and_spends_the_invite(tutor, other):
    dog = make_animal(tutor)
    created = invite(tutor, dog["id"], role="guest", ends="2030-01-10")
    accepted = other.post(f"/invites/{created['token']}/accept")
    assert accepted.status_code == 200
    assert accepted.json() == {"animal_id": dog["id"], "role": "guest", "ends_on": "2030-01-10"}
    assert other.get(f"/animals/{dog['id']}").status_code == 200
    assert Invite.objects.get(token=created["token"]).used_at is not None


def test_an_invite_four_days_old_has_expired(tutor, other):
    dog = make_animal(tutor)
    created = invite(tutor, dog["id"])
    Invite.objects.filter(token=created["token"]).update(
        created_at=timezone.now() - timedelta(days=4)
    )
    response = other.post(f"/invites/{created['token']}/accept")
    assert response.status_code == 410
    assert response.json()["code"] == "invite_expired"
    assert Api().get(f"/invites/{created['token']}").json()["state"] == "expired"


def test_a_spent_invite_cannot_be_used_again(tutor, other):
    dog = make_animal(tutor)
    created = invite(tutor, dog["id"])
    other.post(f"/invites/{created['token']}/accept")
    third = signup("third@example.com")
    response = third.post(f"/invites/{created['token']}/accept")
    assert response.status_code == 409
    assert response.json()["code"] == "invite_used"


def test_someone_who_already_has_access_is_told_so(tutor):
    dog = make_animal(tutor)
    created = invite(tutor, dog["id"])
    response = tutor.post(f"/invites/{created['token']}/accept")
    assert response.status_code == 409
    assert response.json()["code"] == "already_member"
    assert tutor.get(f"/invites/{created['token']}").json()["already_member"] is True


def test_the_tutor_sees_who_has_access(tutor, other):
    dog = make_animal(tutor)
    other.post(f"/invites/{invite(tutor, dog['id'])['token']}/accept")
    people = tutor.get(f"/animals/{dog['id']}/accesses").json()
    assert [(p["email"], p["role"], p["is_me"]) for p in people] == [
        ("other@example.com", "tutor", False),
        ("tutor@example.com", "tutor", True),
    ]


def test_a_guest_sees_the_tutors_and_themselves_but_not_the_other_guests(tutor, other):
    dog = make_animal(tutor)
    second_tutor, second_guest = signup("tutor2@example.com"), signup("guest2@example.com")
    second_tutor.post(f"/invites/{invite(tutor, dog['id'])['token']}/accept")
    other.post(f"/invites/{invite(tutor, dog['id'], 'guest', ends='2099-11-30')['token']}/accept")
    second_guest.post(f"/invites/{invite(tutor, dog['id'], 'guest')['token']}/accept")

    people = other.get(f"/animals/{dog['id']}/accesses").json()
    assert [(p["email"], p["role"], p["ends_on"], p["is_me"]) for p in people] == [
        ("tutor2@example.com", "tutor", None, False),
        ("tutor@example.com", "tutor", None, False),
        ("other@example.com", "guest", "2099-11-30", True),
    ]
    # A tutor still sees everyone.
    assert len(tutor.get(f"/animals/{dog['id']}/accesses").json()) == 4


def test_a_tutor_removes_someone(tutor, other):
    dog = make_animal(tutor)
    other.post(f"/invites/{invite(tutor, dog['id'], 'guest')['token']}/accept")
    guest_access = Access.objects.get(user__email="other@example.com")
    assert tutor.delete(f"/animals/{dog['id']}/accesses/{guest_access.id}").status_code == 204
    assert other.get(f"/animals/{dog['id']}").status_code == 404


def test_only_a_tutor_invites_or_removes(tutor, other):
    dog = make_animal(tutor)
    other.post(f"/invites/{invite(tutor, dog['id'], 'guest')['token']}/accept")
    assert other.post(f"/animals/{dog['id']}/invites", {"role": "guest"}).status_code == 403
    tutor_access = Access.objects.get(user__email="tutor@example.com")
    assert other.delete(f"/animals/{dog['id']}/accesses/{tutor_access.id}").status_code == 403


def test_leaving_works_when_another_tutor_remains(tutor, other):
    dog = make_animal(tutor)
    other.post(f"/invites/{invite(tutor, dog['id'])['token']}/accept")
    mine = Access.objects.get(user__email="tutor@example.com")
    assert tutor.delete(f"/animals/{dog['id']}/accesses/{mine.id}").status_code == 204
    assert tutor.get(f"/animals/{dog['id']}").status_code == 404


def test_the_last_tutor_cannot_leave(tutor):
    dog = make_animal(tutor)
    mine = Access.objects.get(user__email="tutor@example.com")
    response = tutor.delete(f"/animals/{dog['id']}/accesses/{mine.id}")
    assert response.status_code == 409
    assert response.json()["code"] == "last_tutor"


def test_the_last_tutor_cannot_be_removed_by_a_guest_leaving_either(tutor, other):
    dog = make_animal(tutor)
    other.post(f"/invites/{invite(tutor, dog['id'], 'guest')['token']}/accept")
    guest = Access.objects.get(user__email="other@example.com")
    # A guest leaving is fine; the tutor stays.
    assert other.delete(f"/animals/{dog['id']}/accesses/{guest.id}").status_code == 204
    assert Access.objects.filter(animal_id=dog["id"], role="tutor").count() == 1


def test_giving_the_animal_away_is_inviting_the_new_owner_and_leaving(tutor, other):
    dog = make_animal(tutor)
    tutor.post(f"/animals/{dog['id']}/notes", {"date": "2026-10-01", "text": "histórico"})
    other.post(f"/invites/{invite(tutor, dog['id'])['token']}/accept")
    mine = Access.objects.get(user__email="tutor@example.com")
    tutor.delete(f"/animals/{dog['id']}/accesses/{mine.id}")
    records = other.get(f"/animals/{dog['id']}/records").json()
    assert [r["text"] for r in records] == ["histórico"]


def test_deleting_the_animal_takes_its_records_and_files(tutor):
    from conftest import jpeg_file

    dog = make_animal(tutor)
    tutor.upload(f"/animals/{dog['id']}/photo", jpeg_file(), field="file")
    tutor.post(f"/animals/{dog['id']}/notes", {"date": "2026-10-01", "text": "x"})
    from animals.models import Attachment

    stored = Attachment.objects.get()
    storage, name = stored.file.storage, stored.file.name
    assert tutor.delete(f"/animals/{dog['id']}").status_code == 204
    assert not Animal.objects.exists()
    assert not storage.exists(name)


def test_a_tutor_invite_cannot_carry_an_end(tutor):
    dog = make_animal(tutor)
    response = tutor.post(
        f"/animals/{dog['id']}/invites", {"role": "tutor", "access_ends_on": "2030-01-01"}
    )
    assert response.status_code == 422


def test_someone_with_no_account_signs_up_from_the_invite_and_lands_on_the_animal(tutor):
    """The web's way in: the invite, sign-up, the e-mailed code, accepting."""
    dog = make_animal(tutor)
    created = invite(tutor, dog["id"], role="guest", ends="2030-01-10")
    browser = Browser()
    assert browser.get(f"/invites/{created['token']}").json()["already_member"] is False

    signed_up = browser.post(
        f"{BROWSER}/auth/signup", {"email": "nova@example.com", "password": PASSWORD}
    )
    assert signed_up.status_code == 401
    # The invite is a link, sent to no address: it proves nothing about the
    # e-mail, so it cannot be accepted before the code is typed.
    assert browser.post(f"/invites/{created['token']}/accept", {}).status_code == 401

    verified = browser.post(f"{BROWSER}/auth/email/verify", {"key": last_code("nova@example.com")})
    assert verified.status_code == 200
    accepted = browser.post(f"/invites/{created['token']}/accept", {})
    assert accepted.status_code == 200
    assert accepted.json()["animal_id"] == dog["id"]
    assert browser.get(f"/animals/{dog['id']}").status_code == 200
