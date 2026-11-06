"""The notices a person was told, where they were delivered, and where a
person receives pushes."""

import uuid

from django.conf import settings
from django.db import models


class Channel(models.TextChoices):
    EMAIL = "email"
    EXPO = "expo"
    WEBPUSH = "webpush"


class Notice(models.Model):
    """What the app told one tutor about one animal on one day (ADR-0009).

    Written once, with its words frozen; every channel delivers this same
    notice, and the app lists it. `read_at` stays empty until the person opens
    it or marks every notice read.
    """

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="notices"
    )
    animal = models.ForeignKey("animals.Animal", on_delete=models.CASCADE, related_name="+")
    day = models.DateField()
    title = models.CharField(max_length=300)
    body = models.CharField(max_length=500, blank=True)
    # The app path of the animal, e.g. /animais/<id>?assunto=rabies.
    path = models.CharField(max_length=300)
    read_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        indexes = [models.Index(fields=["user", "-created_at"])]


class NoticeItem(models.Model):
    """One reminder at one milestone that a person was told about.

    Unique per person: it is what keeps a milestone from becoming two notices.
    An item with no notice stands for a milestone sent before notices were
    kept, so the change of model sends nothing again.
    """

    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="+")
    notice = models.ForeignKey(
        Notice, null=True, blank=True, on_delete=models.CASCADE, related_name="items"
    )
    reminder_key = models.CharField(max_length=200)
    milestone = models.CharField(max_length=20)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=["user", "reminder_key", "milestone"],
                name="one_notice_per_milestone",
            )
        ]


class Delivery(models.Model):
    """One notice delivered on one channel.

    The unique constraint is the idempotency: the daily job can run twice and
    the second run finds every row already there. A channel that failed has no
    row, so the next run delivers the same notice again.
    """

    notice = models.ForeignKey(Notice, on_delete=models.CASCADE, related_name="deliveries")
    channel = models.CharField(max_length=10, choices=Channel.choices)
    sent_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=["notice", "channel"], name="one_delivery_per_channel")
        ]


class ExpoDevice(models.Model):
    """A phone's Expo push token, per person."""

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="expo_devices"
    )
    token = models.CharField(max_length=200, unique=True)
    created_at = models.DateTimeField(auto_now_add=True)


class WebPushSubscription(models.Model):
    """A browser's push subscription, per person."""

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="webpush_subscriptions"
    )
    endpoint = models.URLField(max_length=1000, unique=True)
    p256dh = models.CharField(max_length=200)
    auth = models.CharField(max_length=100)
    created_at = models.DateTimeField(auto_now_add=True)

    def info(self) -> dict:
        return {"endpoint": self.endpoint, "keys": {"p256dh": self.p256dh, "auth": self.auth}}
