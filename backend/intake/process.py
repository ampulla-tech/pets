"""Running a reading outside the request: the worker picks it up from the database."""

import logging
from datetime import timedelta

from django.conf import settings
from django.db import transaction
from django.utils import timezone

from intake.models import Extraction, ExtractionStatus
from intake.reading import Photo, ReadingFailed, ReadingUnconfigured, read_card

log = logging.getLogger(__name__)


def photos_of(extraction: Extraction) -> list[Photo]:
    photos = []
    for attachment in extraction.photos.order_by("created_at"):
        with attachment.file.open("rb") as handle:
            photos.append(Photo(data=handle.read(), mime_type=attachment.content_type))
    return photos


def process(extraction: Extraction, reader=None) -> Extraction:
    """Read the photos and store the proposals, or the failure.

    `reader(photos, species) -> ReadResult`; the default is the configured model.
    """
    reader = reader or (
        lambda photos, species: read_card(
            photos,
            species,
            settings.INTAKE_MODEL,
            settings.OPENROUTER_API_KEY,
            timeout=settings.INTAKE_TIMEOUT_SECONDS,
        )
    )
    try:
        result = reader(photos_of(extraction), extraction.animal.species)
    except ReadingUnconfigured:
        extraction.status, extraction.error = ExtractionStatus.FAILED, "unconfigured"
    except (ReadingFailed, Exception):
        log.exception("reading failed")
        extraction.status, extraction.error = ExtractionStatus.FAILED, "provider"
    else:
        if not result.proposals:
            extraction.status, extraction.error = ExtractionStatus.FAILED, "nothing_read"
        else:
            extraction.status, extraction.error = ExtractionStatus.READY, ""
            extraction.proposals = [
                {**p, "review": "pending", "record_id": None} for p in result.proposals
            ]
        extraction.model = result.model
        extraction.cost = result.cost
    extraction.finished_at = timezone.now()
    extraction.save()
    return extraction


def claim_next() -> Extraction | None:
    """Take the oldest reading nobody has started, so two workers never share one."""
    with transaction.atomic():
        extraction = (
            Extraction.objects.select_for_update(skip_locked=True)
            .filter(status=ExtractionStatus.PROCESSING, started_at__isnull=True)
            .order_by("created_at")
            .first()
        )
        if extraction is None:
            return None
        extraction.started_at = timezone.now()
        extraction.save(update_fields=["started_at"])
        return extraction


def fail_stuck() -> int:
    """A reading started long ago and never finished (a worker died) is failed."""
    limit = timezone.now() - timedelta(seconds=settings.INTAKE_TIMEOUT_SECONDS * 3)
    return Extraction.objects.filter(
        status=ExtractionStatus.PROCESSING, started_at__lt=limit
    ).update(status=ExtractionStatus.FAILED, error="provider", finished_at=timezone.now())
