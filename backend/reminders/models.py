"""Where a person receives pushes, and the log that keeps each notice to one send."""

from django.conf import settings
from django.db import models


class Channel(models.TextChoices):
    EMAIL = "email"
    EXPO = "expo"
    WEBPUSH = "webpush"


class Delivery(models.Model):
    """One notice of one reminder at one milestone, to one person, on one channel.

    The unique constraint is the idempotency: the daily job can run twice and
    the second run finds every row already there.
    """

    reminder_key = models.CharField(max_length=200)
    animal = models.ForeignKey("animals.Animal", on_delete=models.CASCADE, related_name="+")
    milestone = models.CharField(max_length=20)
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="+")
    channel = models.CharField(max_length=10, choices=Channel.choices)
    sent_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=["reminder_key", "animal", "milestone", "user", "channel"],
                name="one_delivery_per_notice",
            )
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
