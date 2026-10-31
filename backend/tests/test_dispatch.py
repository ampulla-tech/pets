"""The daily evaluation: milestones, tutors only, every channel, once each (ADR-0004)."""

from datetime import date

import pytest
from django.core import mail

from animals.models import Animal
from conftest import CAT, make_animal, signup
from reminders import dispatch
from reminders.models import Delivery, ExpoDevice, WebPushSubscription
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


def test_running_twice_on_a_day_sends_nothing_again(household):
    dispatch.run(date(2027, 6, 6))
    assert len(mail.outbox) == 2
    dispatch.run(date(2027, 6, 6))
    assert len(mail.outbox) == 2


def test_before_the_first_milestone_nothing_goes(household):
    dispatch.run(date(2027, 5, 29))
    assert len(mail.outbox) == 0


def test_a_day_the_job_missed_is_caught_up_once(household):
    dispatch.run(date(2027, 6, 7))
    assert len(mail.outbox) == 2
    assert "Raiva: atrasado há 1 dia (venceu em 06/06/2027)" in mail.outbox[0].body
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


def test_the_email_says_the_animal_the_disease_the_date_the_state_and_links(household):
    dispatch.run(date(2027, 5, 30))
    message = mail.outbox[0]
    assert message.subject == "Lacan: Raiva vence em breve"
    assert "Raiva: vence em 7 dias (06/06/2027)" in message.body
    assert f"/animais/{household['id']}?assunto=rabies" in message.body
    mail.outbox.clear()
    dispatch.run(date(2027, 6, 13))
    assert "Raiva: atrasado há 7 dias (venceu em 06/06/2027)" in mail.outbox[0].body


def test_doses_of_one_day_go_out_as_one_message(tutor):
    cat = make_animal(tutor, CAT)
    tutor.post(
        f"/animals/{cat['id']}/vaccines",
        {
            "date": "2026-06-06",
            "diseases": ["rhinotracheitis", "calicivirus"],
            "repeat_on": "2027-06-06",
        },
    )
    dispatch.run(date(2027, 6, 6))
    assert len(mail.outbox) == 1
    assert "Rinotraqueíte: vence hoje" in mail.outbox[0].body
    assert "Calicivirose: vence hoje" in mail.outbox[0].body
    assert Delivery.objects.count() == 2


def test_a_failed_channel_is_retried_by_the_next_run(household, monkeypatch):
    def broken(*args, **kwargs):
        raise RuntimeError("provider down")

    dispatch.run(date(2027, 6, 6), channels={"email": broken})
    assert Delivery.objects.count() == 0
    dispatch.run(date(2027, 6, 7))
    assert len(mail.outbox) == 2


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
        "expo": lambda u, a, m: dispatch.send_expo(u, a, m, client=client),
    }
    dispatch.run(date(2027, 6, 6), channels=channels)
    assert sorted(m.to for m in client.sent) == [
        "ExponentPushToken[a]",
        "ExponentPushToken[b]",
        "ExponentPushToken[c]",
    ]
    assert client.sent[0].data["subject"] == "rabies"
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

    channels = {"webpush": lambda u, a, m: dispatch.send_webpush(u, a, m, webpush=fake_webpush)}
    dispatch.run(date(2027, 6, 6), channels=channels)
    assert sorted(calls) == ["https://push.example/gone", "https://push.example/live"]
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
