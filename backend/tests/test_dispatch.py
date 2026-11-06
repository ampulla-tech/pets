"""The daily evaluation: milestones, tutors only, one kept notice, every channel,
once each (ADR-0004, ADR-0009)."""

import json
from datetime import date

import pytest
from django.core import mail

from animals.models import Animal
from conftest import CAT, make_animal, signup
from reminders import dispatch
from reminders.models import Delivery, ExpoDevice, Notice, NoticeItem, WebPushSubscription
from tests.test_people import invite

RABIES = {
    "date": "2026-06-06",
    "brand": "Bioraiva Pet",
    "diseases": ["rabies"],
    "repeat_on": "2027-06-06",
}


@pytest.fixture
def household(tutor, other):
    cat = make_animal(tutor, CAT)
    other.post(f"/invites/{invite(tutor, cat['id'])['token']}/accept")
    guest = signup("guest@example.com")
    guest.post(f"/invites/{invite(tutor, cat['id'], 'guest')['token']}/accept")
    tutor.post(f"/animals/{cat['id']}/vaccines", RABIES)
    return cat


def emails_to():
    return sorted(m.to[0] for m in mail.outbox)


def test_each_tutor_gets_one_email_per_milestone_and_the_guest_none(household):
    for day in ("2027-05-30", "2027-06-06", "2027-06-13", "2027-06-20"):
        mail.outbox.clear()
        dispatch.run(date.fromisoformat(day))
        assert emails_to() == ["other@example.com", "tutor@example.com"], day


def test_running_twice_on_a_day_writes_and_sends_nothing_again(household):
    dispatch.run(date(2027, 6, 6))
    assert len(mail.outbox) == 2
    assert Notice.objects.count() == 2
    assert Delivery.objects.count() == 2
    dispatch.run(date(2027, 6, 6))
    assert len(mail.outbox) == 2
    assert Notice.objects.count() == 2
    assert Delivery.objects.count() == 2


def test_before_the_first_milestone_nothing_goes(household):
    dispatch.run(date(2027, 5, 29))
    assert len(mail.outbox) == 0


def test_a_day_the_job_missed_is_caught_up_once(household):
    dispatch.run(date(2027, 6, 7))
    assert len(mail.outbox) == 2
    assert mail.outbox[0].subject == "A vacina do Lacan está atrasada há 1 dia."
    dispatch.run(date(2027, 6, 8))
    assert len(mail.outbox) == 2


def test_a_new_rabies_dose_stops_the_reminder(household, tutor):
    tutor.post(
        f"/animals/{household['id']}/vaccines",
        {"date": "2027-06-15", "diseases": ["rabies"], "repeat_on": "2028-06-15"},
    )
    dispatch.run(date(2027, 6, 20))
    assert len(mail.outbox) == 0


def test_an_archived_animal_sends_nothing(household):
    Animal.objects.update(status="archived")
    dispatch.run(date(2027, 6, 6))
    assert len(mail.outbox) == 0


def test_the_email_subject_is_the_notice_title_and_the_body_links_the_animal(tutor):
    cat = make_animal(tutor, {**CAT, "name": "Paçoca", "sex": "female"})
    tutor.post(f"/animals/{cat['id']}/vaccines", {**RABIES, "brand": "Vanguard Plus"})
    dispatch.run(date(2027, 6, 6))
    message = mail.outbox[0]
    assert message.subject == "Hoje é dia de vacinar a Paçoca."
    assert message.body.startswith("Hoje é dia de vacinar a Paçoca.\nVanguard Plus\n")
    assert f"/animais/{cat['id']}?assunto=rabies" in message.body
    assert "porque é tutor deste animal" in message.body
    notice = Notice.objects.get()
    assert (notice.title, notice.body, notice.day) == (
        "Hoje é dia de vacinar a Paçoca.",
        "Vanguard Plus",
        date(2027, 6, 6),
    )
    assert notice.read_at is None


def test_a_combined_vaccine_is_one_vaccine_in_one_notice(tutor):
    cat = make_animal(tutor, CAT)
    tutor.post(
        f"/animals/{cat['id']}/vaccines",
        {
            "date": "2026-06-06",
            "brand": "Felocell",
            "diseases": ["rhinotracheitis", "calicivirus"],
            "repeat_on": "2027-06-06",
        },
    )
    dispatch.run(date(2027, 6, 6))
    assert len(mail.outbox) == 1
    assert mail.outbox[0].subject == "Hoje é dia de vacinar o Lacan."
    assert NoticeItem.objects.count() == 2
    assert Delivery.objects.count() == 1


def test_the_words_of_a_notice_never_change_after_it_is_written(household, tutor):
    dispatch.run(date(2027, 6, 6))
    tutor.put(f"/animals/{household['id']}", {**CAT, "name": "Outro"})
    notice = Notice.objects.filter(user__email="tutor@example.com").get()
    assert notice.title == "Hoje é dia de vacinar o Lacan."


def test_a_failed_channel_is_retried_by_the_next_run(household, monkeypatch):
    def broken(*args, **kwargs):
        raise RuntimeError("provider down")

    dispatch.run(date(2027, 6, 6), channels={"email": broken})
    assert Delivery.objects.count() == 0
    assert Notice.objects.count() == 2
    dispatch.run(date(2027, 6, 7))
    # The same notices, with the words of the day they were written.
    assert len(mail.outbox) == 2
    assert {m.subject for m in mail.outbox} == {"Hoje é dia de vacinar o Lacan."}
    assert Notice.objects.count() == 2


def test_a_notice_older_than_a_day_is_not_delivered_any_more(household):
    def broken(*args, **kwargs):
        raise RuntimeError("provider down")

    dispatch.run(date(2027, 6, 6), channels={"email": broken})
    dispatch.run(date(2027, 6, 8))
    assert len(mail.outbox) == 0


def test_a_channel_with_no_destination_is_not_logged(household):
    dispatch.run(date(2027, 6, 6))
    assert set(Delivery.objects.values_list("channel", flat=True)) == {"email"}


def test_a_milestone_sent_before_notices_were_kept_is_not_sent_again(household):
    from django.contrib.auth import get_user_model

    from reminders.service import reminders_of

    # What migration 0003 leaves for a milestone the old sending log had.
    cat = Animal.objects.get()
    key = reminders_of(cat, date(2027, 6, 6))[0].key
    for user in get_user_model().objects.exclude(email="guest@example.com"):
        NoticeItem.objects.create(user=user, reminder_key=key, milestone="due", notice=None)
    dispatch.run(date(2027, 6, 6))
    assert len(mail.outbox) == 0
    assert Notice.objects.count() == 0


# ── Expo push ───────────────────────────────────────────────────────────────


class FakeTicket:
    def __init__(self, message, error=None):
        self.message, self.error = message, error

    def validate_response(self):
        if self.error:
            raise self.error


class FakePushClient:
    def __init__(self, unregistered=()):
        self.sent = []
        self.unregistered = set(unregistered)

    def publish_multiple(self, messages):
        from exponent_server_sdk import DeviceNotRegisteredError, PushTicket

        self.sent.extend(messages)
        tickets = []
        for message in messages:
            error = None
            if message.to in self.unregistered:
                error = DeviceNotRegisteredError(
                    PushTicket(
                        push_message=message,
                        status="error",
                        message="gone",
                        details={"error": "DeviceNotRegistered"},
                        id=None,
                    )
                )
            tickets.append(FakeTicket(message, error))
        return tickets


def test_push_goes_to_every_phone_of_every_tutor_once(household):
    from django.contrib.auth import get_user_model

    users = {u.email: u for u in get_user_model().objects.all()}
    ExpoDevice.objects.create(user=users["tutor@example.com"], token="ExponentPushToken[a]")
    ExpoDevice.objects.create(user=users["other@example.com"], token="ExponentPushToken[b]")
    ExpoDevice.objects.create(user=users["other@example.com"], token="ExponentPushToken[c]")
    ExpoDevice.objects.create(user=users["guest@example.com"], token="ExponentPushToken[g]")
    client = FakePushClient(unregistered={"ExponentPushToken[c]"})
    channels = {
        "email": dispatch.send_email,
        "expo": lambda u, m: dispatch.send_expo(u, m, client=client),
    }
    dispatch.run(date(2027, 6, 6), channels=channels)
    assert sorted(m.to for m in client.sent) == [
        "ExponentPushToken[a]",
        "ExponentPushToken[b]",
        "ExponentPushToken[c]",
    ]
    notice = Notice.objects.get(user=users["tutor@example.com"])
    sent = next(m for m in client.sent if m.to == "ExponentPushToken[a]")
    assert (sent.title, sent.data["notice_id"]) == (notice.title, str(notice.id))
    assert sent.data["url"].endswith(notice.path)
    assert not ExpoDevice.objects.filter(token="ExponentPushToken[c]").exists()
    assert len(mail.outbox) == 2
    dispatch.run(date(2027, 6, 6), channels=channels)
    assert len(client.sent) == 3


# ── Web push ────────────────────────────────────────────────────────────────


def test_web_push_drops_a_gone_subscription_and_never_resends(household, settings):
    from django.contrib.auth import get_user_model
    from pywebpush import WebPushException

    settings.VAPID_PRIVATE_KEY = "test-key"
    tutor = get_user_model().objects.get(email="tutor@example.com")
    WebPushSubscription.objects.create(
        user=tutor, endpoint="https://push.example/live", p256dh="k", auth="a"
    )
    WebPushSubscription.objects.create(
        user=tutor, endpoint="https://push.example/gone", p256dh="k", auth="a"
    )
    calls = []

    class Gone:
        status_code = 410

    def fake_webpush(subscription_info, data, **kwargs):
        calls.append(subscription_info["endpoint"])
        if subscription_info["endpoint"].endswith("gone"):
            raise WebPushException("gone", response=Gone())

    payloads = []

    def recording(subscription_info, data, **kwargs):
        payloads.append(json.loads(data))
        fake_webpush(subscription_info, data, **kwargs)

    channels = {"webpush": lambda u, m: dispatch.send_webpush(u, m, webpush=recording)}
    dispatch.run(date(2027, 6, 6), channels=channels)
    assert sorted(calls) == ["https://push.example/gone", "https://push.example/live"]
    notice = Notice.objects.get(user=tutor)
    assert payloads[0]["title"] == "Hoje é dia de vacinar o Lacan."
    assert payloads[0]["notice_id"] == str(notice.id)
    assert list(WebPushSubscription.objects.values_list("endpoint", flat=True)) == [
        "https://push.example/live"
    ]
    dispatch.run(date(2027, 6, 6), channels=channels)
    assert len(calls) == 2


def test_push_destinations_are_registered_and_removed(tutor):
    assert tutor.post("/push/expo", {"token": "ExponentPushToken[x]"}).status_code == 204
    assert ExpoDevice.objects.count() == 1
    tutor.post("/push/expo/remove", {"token": "ExponentPushToken[x]"})
    assert ExpoDevice.objects.count() == 0
    body = {"endpoint": "https://push.example/1", "keys": {"p256dh": "p", "auth": "a"}}
    assert tutor.post("/push/webpush", body).status_code == 204
    tutor.post("/push/webpush/remove", {"endpoint": "https://push.example/1"})
    assert WebPushSubscription.objects.count() == 0
