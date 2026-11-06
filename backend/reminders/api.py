"""Reminders as the app shows them, and the push destinations a person registers."""

from datetime import date
from typing import Literal
from uuid import UUID

from django.conf import settings
from django.db import IntegrityError
from django.utils import timezone
from ninja import Router, Schema, Status

from animals.access import access_to
from animals.diseases import label
from reminders.logic import Reminder
from reminders.models import ExpoDevice, WebPushSubscription
from reminders.service import reminders_of

router = Router(tags=["reminders"])

StateName = Literal["no_date", "scheduled", "upcoming", "due", "overdue", "closed", "suspended"]


class ReminderOut(Schema):
    animal_id: UUID
    animal_name: str
    species: Literal["dog", "cat"]
    subject: str
    subject_label: str
    state: StateName
    due_on: date | None
    days: int | None
    record_kind: Literal["vaccine", "antiparasitic"]
    record_id: UUID
    dose_date: date


def reminder_out(animal, reminder: Reminder, today: date) -> dict:
    return {
        "animal_id": animal.id,
        "animal_name": animal.name,
        "species": animal.species,
        "subject": reminder.subject,
        "subject_label": label(reminder.subject),
        "state": reminder.state.value,
        "due_on": reminder.due_on,
        "days": (reminder.due_on - today).days if reminder.due_on else None,
        "record_kind": reminder.source.record_kind,
        "record_id": reminder.source.record_id,
        "dose_date": reminder.source.date,
    }


@router.get("/animals/{animal_id}/reminders", response=list[ReminderOut])
def list_animal_reminders(request, animal_id: UUID):
    """Every reminder of one animal, open, closed and with no date."""
    animal = access_to(request.auth, animal_id).animal
    today = timezone.localdate()
    order = {
        "overdue": 0,
        "due": 1,
        "upcoming": 2,
        "no_date": 3,
        "scheduled": 4,
        "suspended": 5,
        "closed": 6,
    }
    reminders = [reminder_out(animal, r, today) for r in reminders_of(animal, today)]
    reminders.sort(key=lambda r: (order[r["state"]], r["due_on"] or date.max, r["subject_label"]))
    return reminders


# ── Push destinations ───────────────────────────────────────────────────────


class ExpoTokenIn(Schema):
    token: str


@router.post("/push/expo", response={204: None}, tags=["push"])
def register_expo_token(request, payload: ExpoTokenIn):
    """Register this phone's Expo push token for the caller (moves it if another had it)."""
    ExpoDevice.objects.filter(token=payload.token).exclude(user=request.auth).delete()
    try:
        ExpoDevice.objects.get_or_create(token=payload.token, defaults={"user": request.auth})
    except IntegrityError:
        pass
    return Status(204, None)


@router.post("/push/expo/remove", response={204: None}, tags=["push"])
def remove_expo_token(request, payload: ExpoTokenIn):
    """Forget this phone's token (sign-out)."""
    ExpoDevice.objects.filter(token=payload.token, user=request.auth).delete()
    return Status(204, None)


class WebPushKeys(Schema):
    p256dh: str
    auth: str


class WebPushIn(Schema):
    endpoint: str
    keys: WebPushKeys


class WebPushEndpointIn(Schema):
    endpoint: str


class WebPushKeyOut(Schema):
    public_key: str


@router.get("/push/webpush/key", response=WebPushKeyOut, tags=["push"])
def get_webpush_key(request):
    """The VAPID public key the browser subscribes with; empty when push is off."""
    return {"public_key": settings.VAPID_PUBLIC_KEY}


@router.post("/push/webpush", response={204: None}, tags=["push"])
def register_webpush(request, payload: WebPushIn):
    WebPushSubscription.objects.update_or_create(
        endpoint=payload.endpoint,
        defaults={
            "user": request.auth,
            "p256dh": payload.keys.p256dh,
            "auth": payload.keys.auth,
        },
    )
    return Status(204, None)


@router.post("/push/webpush/remove", response={204: None}, tags=["push"])
def remove_webpush(request, payload: WebPushEndpointIn):
    WebPushSubscription.objects.filter(endpoint=payload.endpoint, user=request.auth).delete()
    return Status(204, None)
