"""One reading of a card's photos, and the records it proposes."""

import uuid

from django.conf import settings
from django.db import models


class ExtractionStatus(models.TextChoices):
    PROCESSING = "processing"
    READY = "ready"
    FAILED = "failed"


class Extraction(models.Model):
    """Photos sent to be read, the state of the reading, and its proposals.

    `proposals` is the list the reading returned, each entry with a `review`
    state of its own: `pending` until the tutor confirms it (`confirmed`, with
    the id of the record written) or discards it (`discarded`). Nothing becomes
    a record without that confirmation.
    """

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    animal = models.ForeignKey(
        "animals.Animal", on_delete=models.CASCADE, related_name="extractions"
    )
    photos = models.ManyToManyField("animals.Attachment", related_name="extractions")
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, null=True, on_delete=models.SET_NULL, related_name="+"
    )
    status = models.CharField(
        max_length=12, choices=ExtractionStatus.choices, default=ExtractionStatus.PROCESSING
    )
    error = models.CharField(max_length=40, blank=True)
    model = models.CharField(max_length=120, blank=True)
    proposals = models.JSONField(default=list)
    cost = models.FloatField(null=True, blank=True)
    started_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    finished_at = models.DateTimeField(null=True, blank=True)
