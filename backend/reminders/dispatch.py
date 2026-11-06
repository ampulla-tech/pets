"""The daily evaluation: every reminder that reached a milestone becomes a
notice to every tutor, and every channel the tutor has delivers that notice
(ADR-0004, ADR-0009).

A notice is written once per person, animal and day, with its words frozen
(`reminders.wording`). Its items, (reminder, milestone) unique per person, keep
a milestone from becoming a second notice, so running twice in a day writes
nothing the second time. Then each channel delivers the notices it has not
delivered yet: e-mail always, an Expo push to each of the tutor's phones and a
web push to each of the tutor's browsers. A delivery that reached nobody (no
phone, no browser) is not logged, nor is one that failed, and the next run
tries the same notice again while it is recent. A guest is never a recipient,
nor is an archived animal ever evaluated.
"""

import logging
from dataclasses import dataclass
from datetime import date, timedelta

from django.conf import settings
from django.core.mail import send_mail
from django.db import IntegrityError, transaction
from django.utils import timezone

from animals.access import tutors_of
from animals.models import Animal, AnimalStatus
from reminders.logic import OPEN_STATES, Reminder, milestone_on
from reminders.models import (
    Channel,
    Delivery,
    ExpoDevice,
    Notice,
    NoticeItem,
    WebPushSubscription,
)
from reminders.service import reminders_of
from reminders.wording import word

log = logging.getLogger(__name__)

# How long an undelivered notice is still worth delivering: a failed channel is
# tried again by the next day's run, never days later with its words stale.
RETRY_FOR = timedelta(days=1)


@dataclass(frozen=True)
class Message:
    """A notice as a channel sends it."""

    title: str
    body: str
    url: str
    data: dict


def owed_by(animal: Animal, today: date) -> list[tuple[Reminder, str]]:
    """The open reminders of an animal that reached a milestone today."""
    if animal.status != AnimalStatus.ACTIVE:
        return []
    owed = []
    for reminder in reminders_of(animal, today):
        if reminder.state in OPEN_STATES and reminder.due_on:
            milestone = milestone_on(reminder.due_on, today)
            if milestone:
                owed.append((reminder, milestone))
    return owed


def write_notice(user, animal: Animal, owed, today: date) -> Notice | None:
    """The notice of what `user` was not yet told about `animal`, or None."""
    told = set(
        NoticeItem.objects.filter(user=user, reminder_key__in=[r.key for r, _ in owed]).values_list(
            "reminder_key", "milestone"
        )
    )
    fresh = [(r, m) for r, m in owed if (r.key, m) not in told]
    if not fresh:
        return None
    wording = word(animal.name, animal.sex, fresh, today)
    first = fresh[0][0].subject
    try:
        with transaction.atomic():
            notice = Notice.objects.create(
                user=user,
                animal=animal,
                day=today,
                title=wording.title,
                body=wording.body,
                path=f"/animais/{animal.id}?assunto={first}",
            )
            NoticeItem.objects.bulk_create(
                [
                    NoticeItem(user=user, notice=notice, reminder_key=r.key, milestone=m)
                    for r, m in fresh
                ]
            )
    except IntegrityError:
        # Another run wrote it first.
        return None
    return notice


def message_of(notice: Notice) -> Message:
    url = f"{settings.WEB_APP_URL}{notice.path}"
    return Message(
        title=notice.title,
        body=notice.body,
        url=url,
        data={"notice_id": str(notice.id), "animal_id": str(notice.animal_id), "url": url},
    )


# ── Channels ────────────────────────────────────────────────────────────────


def send_email(user, message: Message) -> bool:
    lines = [message.title]
    if message.body:
        lines.append(message.body)
    body = (
        "\n".join(lines) + f"\n\nAbrir no app: {message.url}\n\n"
        "Você recebe este aviso porque é tutor deste animal no Pets."
    )
    send_mail(message.title, body, settings.DEFAULT_FROM_EMAIL, [user.email])
    return True


def send_expo(user, message: Message, client=None) -> bool:
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
            body=message.body or None,
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


def send_webpush(user, message: Message, webpush=None) -> bool:
    """Push to each of the tutor's browsers; a subscription gone (404/410) is dropped."""
    import json

    from pywebpush import WebPushException
    from pywebpush import webpush as real_webpush

    subscriptions = list(WebPushSubscription.objects.filter(user=user))
    if not subscriptions or not settings.VAPID_PRIVATE_KEY:
        return False
    webpush = webpush or real_webpush
    payload = json.dumps({"title": message.title, "body": message.body, **message.data})
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


def deliver(today: date, channels) -> int:
    """Deliver every recent notice on each channel that has not delivered it."""
    sent = 0
    recent = (
        Notice.objects.filter(day__gte=today - RETRY_FOR, animal__status=AnimalStatus.ACTIVE)
        .select_related("user")
        .order_by("created_at")
    )
    for notice in recent:
        done = set(notice.deliveries.values_list("channel", flat=True))
        for channel, send in channels.items():
            if channel in done:
                continue
            try:
                reached = send(notice.user, message_of(notice))
            except Exception:
                log.exception("notice %s failed on %s", notice.id, channel)
                continue
            if reached:
                try:
                    with transaction.atomic():
                        Delivery.objects.create(notice=notice, channel=channel)
                except IntegrityError:
                    pass
                sent += 1
    return sent


def run(today: date | None = None, channels=None) -> int:
    """Write today's notices and deliver what is owed. Returns messages sent."""
    today = today or timezone.localdate()
    channels = channels or CHANNELS
    for animal in Animal.objects.filter(status=AnimalStatus.ACTIVE):
        owed = owed_by(animal, today)
        if not owed:
            continue
        for user in tutors_of(animal):
            write_notice(user, animal, owed, today)
    return deliver(today, channels)
