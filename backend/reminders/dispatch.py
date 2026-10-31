"""The daily evaluation: every reminder that reached a milestone, to every tutor,
on every channel the tutor has (ADR-0004).

E-mail always goes; an Expo push goes to each of the tutor's phones and a web
push to each of the tutor's browsers. The sending log (`Delivery`) keeps each
(reminder, milestone, person, channel) to one send, so running twice in a day
sends nothing the second time. A channel that fails is not logged and is tried
again by the next run. A guest is never a recipient, nor is an archived animal
ever evaluated.

The notices of one animal reached on the same day go out together, as one
message per person and channel.
"""

import logging
from dataclasses import dataclass
from datetime import date

from django.conf import settings
from django.core.mail import send_mail
from django.db import IntegrityError, transaction
from django.utils import timezone

from animals.access import tutors_of
from animals.diseases import label
from animals.models import Animal, AnimalStatus
from reminders.logic import OPEN_STATES, Reminder, milestone_on
from reminders.models import Channel, Delivery, ExpoDevice, WebPushSubscription
from reminders.service import reminders_of

log = logging.getLogger(__name__)


@dataclass(frozen=True)
class Notice:
    reminder: Reminder
    milestone: str


@dataclass(frozen=True)
class Message:
    title: str
    body: str
    url: str
    data: dict


def describe(notice: Notice, today: date) -> str:
    """The notice in words, from the day it is sent (a caught-up notice stays true)."""
    due = notice.reminder.due_on
    subject = label(notice.reminder.subject)
    when = due.strftime("%d/%m/%Y")
    days = (due - today).days
    if days > 0:
        return f"{subject}: vence em {days} {'dia' if days == 1 else 'dias'} ({when})"
    if days == 0:
        return f"{subject}: vence hoje ({when})"
    late = -days
    return f"{subject}: atrasado há {late} {'dia' if late == 1 else 'dias'} (venceu em {when})"


def compose(animal: Animal, notices: list[Notice], today: date) -> Message:
    lines = [describe(n, today) for n in notices]
    subjects = ", ".join(label(n.reminder.subject) for n in notices)
    nearest = min((n.reminder.due_on - today).days for n in notices)
    if nearest < 0:
        title = f"{animal.name}: {subjects} atrasado"
    elif nearest == 0:
        title = f"{animal.name}: {subjects} vence hoje"
    else:
        title = f"{animal.name}: {subjects} vence em breve"
    first = notices[0].reminder.subject
    url = f"{settings.WEB_APP_URL}/animais/{animal.id}?assunto={first}"
    return Message(
        title=title,
        body="\n".join(lines),
        url=url,
        data={"animal_id": str(animal.id), "subject": first, "url": url},
    )


def notices_of(animal: Animal, today: date) -> list[Notice]:
    if animal.status != AnimalStatus.ACTIVE:
        return []
    notices = []
    for reminder in reminders_of(animal, today):
        if reminder.state in OPEN_STATES and reminder.due_on:
            milestone = milestone_on(reminder.due_on, today)
            if milestone:
                notices.append(Notice(reminder, milestone))
    return notices


# ── Channels ────────────────────────────────────────────────────────────────


def send_email(user, animal: Animal, message: Message) -> bool:
    body = (
        f"{message.body}\n\nAbrir {animal.name} no app: {message.url}\n\n"
        "Você recebe este aviso porque é tutor deste animal no Pets."
    )
    send_mail(message.title, body, settings.DEFAULT_FROM_EMAIL, [user.email])
    return True


def send_expo(user, animal: Animal, message: Message, client=None) -> bool:
    """Push to each of the tutor's phones; a token Expo calls unregistered is dropped.

    Returns whether at least one phone was reached (False when the tutor has none).
    """
    from exponent_server_sdk import (
        DeviceNotRegisteredError,
        PushClient,
        PushMessage,
        PushTicketError,
    )

    devices = list(ExpoDevice.objects.filter(user=user))
    if not devices:
        return False
    if client is None:
        session = None
        if settings.EXPO_ACCESS_TOKEN:
            import requests

            session = requests.Session()
            session.headers["Authorization"] = f"Bearer {settings.EXPO_ACCESS_TOKEN}"
        client = PushClient(session=session)
    messages = [
        PushMessage(
            to=device.token,
            title=message.title,
            body=message.body,
            data=message.data,
            sound="default",
        )
        for device in devices
    ]
    tickets = client.publish_multiple(messages)
    reached = False
    for device, ticket in zip(devices, tickets, strict=True):
        try:
            ticket.validate_response()
            reached = True
        except DeviceNotRegisteredError:
            device.delete()
        except PushTicketError as error:
            log.warning("expo push refused for a device: %s", error)
    return reached


def send_webpush(user, animal: Animal, message: Message, webpush=None) -> bool:
    """Push to each of the tutor's browsers; a subscription gone (404/410) is dropped."""
    import json

    from pywebpush import WebPushException
    from pywebpush import webpush as real_webpush

    subscriptions = list(WebPushSubscription.objects.filter(user=user))
    if not subscriptions or not settings.VAPID_PRIVATE_KEY:
        return False
    webpush = webpush or real_webpush
    payload = json.dumps(
        {"title": message.title, "body": message.body, "url": message.url, **message.data}
    )
    reached = False
    for subscription in subscriptions:
        try:
            webpush(
                subscription_info=subscription.info(),
                data=payload,
                vapid_private_key=settings.VAPID_PRIVATE_KEY,
                vapid_claims={"sub": settings.VAPID_SUBJECT},
            )
            reached = True
        except WebPushException as error:
            status = getattr(error.response, "status_code", None)
            if status in (404, 410):
                subscription.delete()
            else:
                log.warning("web push refused for a subscription: %s", error)
    return reached


CHANNELS = {
    Channel.EMAIL: send_email,
    Channel.EXPO: send_expo,
    Channel.WEBPUSH: send_webpush,
}


# ── The run ─────────────────────────────────────────────────────────────────


def _pending(animal, notices, user, channel) -> list[Notice]:
    sent = set(
        Delivery.objects.filter(
            animal=animal,
            user=user,
            channel=channel,
            reminder_key__in=[n.reminder.key for n in notices],
        ).values_list("reminder_key", "milestone")
    )
    return [n for n in notices if (n.reminder.key, n.milestone) not in sent]


def _log(animal, notices, user, channel) -> None:
    for notice in notices:
        try:
            with transaction.atomic():
                Delivery.objects.create(
                    reminder_key=notice.reminder.key,
                    animal=animal,
                    milestone=notice.milestone,
                    user=user,
                    channel=channel,
                )
        except IntegrityError:
            pass


def run(today: date | None = None, channels=None) -> int:
    """Evaluate every active animal and send what is owed. Returns messages sent."""
    today = today or timezone.localdate()
    channels = channels or CHANNELS
    sent = 0
    for animal in Animal.objects.filter(status=AnimalStatus.ACTIVE):
        notices = notices_of(animal, today)
        if not notices:
            continue
        for user in tutors_of(animal):
            for channel, send in channels.items():
                pending = _pending(animal, notices, user, channel)
                if not pending:
                    continue
                message = compose(animal, pending, today)
                try:
                    reached = send(user, animal, message)
                except Exception:
                    log.exception("reminder %s failed for one tutor", channel)
                    continue
                if reached:
                    _log(animal, pending, user, channel)
                    sent += 1
    return sent
