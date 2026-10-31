"""Photo intake: send card photos, follow the reading, confirm or discard each line."""

from typing import Annotated, Literal
from uuid import UUID

from django.db import transaction
from django.shortcuts import get_object_or_404
from ninja import File, Router, Schema, Status, UploadedFile
from ninja.errors import HttpError
from pydantic import Field

from animals import attachments as storage
from animals.access import access_to, as_tutor
from animals.api import attachment_out, create_record, record_out
from animals.models import AnimalStatus, Antiparasitic, Vaccine, Weight
from animals.schemas import (
    AntiparasiticIn,
    AttachmentOut,
    RecordOut,
    VaccineIn,
    WeightIn,
)
from intake.models import Extraction, ExtractionStatus

router = Router(tags=["intake"])

MAX_PHOTOS = 6


class TextValueOut(Schema):
    value: str | None
    read: bool


class NumberValueOut(Schema):
    value: float | None
    read: bool


class CodesValueOut(Schema):
    value: list[str]
    read: bool


class RepeatOnValueOut(Schema):
    value: str | None
    read: bool
    origin: Literal["written", "inferred"] | None


class ProposalOut(Schema):
    index: int
    kind: Literal["vaccine", "antiparasitic", "weight"]
    date: TextValueOut
    brand: TextValueOut
    lot: TextValueOut
    lot_expiry: TextValueOut
    diseases: CodesValueOut
    repeat_on: RepeatOnValueOut
    vet_name: TextValueOut
    vet_crmv: TextValueOut
    dose: TextValueOut
    weight_kg: NumberValueOut
    review: Literal["pending", "confirmed", "discarded"]
    record_id: UUID | None


class ExtractionOut(Schema):
    id: UUID
    animal_id: UUID
    status: Literal["processing", "ready", "failed"]
    error: Literal["", "unconfigured", "provider", "nothing_read"]
    photos: list[AttachmentOut]
    proposals: list[ProposalOut]


def extraction_out(request, extraction: Extraction) -> dict:
    return {
        "id": extraction.id,
        "animal_id": extraction.animal_id,
        "status": extraction.status,
        "error": extraction.error,
        "photos": [attachment_out(request, a) for a in extraction.photos.order_by("created_at")],
        "proposals": [{"index": i, **p} for i, p in enumerate(extraction.proposals)],
    }


def _readable(request, extraction_id) -> Extraction:
    extraction = get_object_or_404(Extraction, id=extraction_id)
    access_to(request.auth, extraction.animal_id)
    return extraction


def _for_tutor(request, extraction_id, lock=False) -> Extraction:
    queryset = Extraction.objects.select_for_update() if lock else Extraction.objects
    extraction = get_object_or_404(queryset, id=extraction_id)
    as_tutor(request.auth, extraction.animal_id)
    return extraction


@router.post("/animals/{animal_id}/extractions", response={202: ExtractionOut})
def create_extraction(request, animal_id: UUID, files: File[list[UploadedFile]]):
    """Send one or more photos of a card page; the reading runs in the background."""
    animal = as_tutor(request.auth, animal_id)
    if animal.status != AnimalStatus.ACTIVE:
        raise HttpError(409, "an archived animal is read-only")
    if not files or len(files) > MAX_PHOTOS:
        raise HttpError(422, f"send between 1 and {MAX_PHOTOS} photos")
    photos = [storage.store_upload(animal, upload, request.auth) for upload in files]
    if any(not p.is_image for p in photos):
        storage.delete_orphans(photos)
        raise HttpError(415, "only photos can be read")
    extraction = Extraction.objects.create(animal=animal, created_by=request.auth)
    extraction.photos.set(photos)
    return Status(202, extraction_out(request, extraction))


@router.get("/extractions/{extraction_id}", response=ExtractionOut)
def get_extraction(request, extraction_id: UUID):
    return extraction_out(request, _readable(request, extraction_id))


@router.post("/extractions/{extraction_id}/retry", response={202: ExtractionOut})
def retry_extraction(request, extraction_id: UUID):
    """Read the same photos again, after a failure."""
    extraction = _for_tutor(request, extraction_id)
    if extraction.status != ExtractionStatus.FAILED:
        raise HttpError(409, "only a failed reading is retried")
    extraction.status = ExtractionStatus.PROCESSING
    extraction.error = ""
    extraction.started_at = None
    extraction.finished_at = None
    extraction.save()
    return Status(202, extraction_out(request, extraction))


class VaccineConfirm(VaccineIn):
    kind: Literal["vaccine"]


class AntiparasiticConfirm(AntiparasiticIn):
    kind: Literal["antiparasitic"]


class WeightConfirm(WeightIn):
    kind: Literal["weight"]


class ConfirmIn(Schema):
    record: Annotated[
        VaccineConfirm | AntiparasiticConfirm | WeightConfirm, Field(discriminator="kind")
    ]


MODELS = {"vaccine": Vaccine, "antiparasitic": Antiparasitic, "weight": Weight}


def _pending(extraction: Extraction, index: int) -> dict:
    if extraction.status != ExtractionStatus.READY:
        raise HttpError(409, "the reading is not ready")
    if index < 0 or index >= len(extraction.proposals):
        raise HttpError(404, "Not Found")
    proposal = extraction.proposals[index]
    if proposal["review"] != "pending":
        raise HttpError(409, "this line was already reviewed")
    return proposal


@router.post("/extractions/{extraction_id}/proposals/{index}/confirm", response={201: RecordOut})
def confirm_proposal(request, extraction_id: UUID, index: int, payload: ConfirmIn):
    """Write one line as a record, as the tutor corrected it, with the whole photos attached."""
    with transaction.atomic():
        extraction = _for_tutor(request, extraction_id, lock=True)
        proposal = _pending(extraction, index)
        record, access = create_record(
            request,
            extraction.animal_id,
            MODELS[payload.record.kind],
            payload.record,
            extra_attachments=list(extraction.photos.all()),
        )
        proposal["review"] = "confirmed"
        proposal["record_id"] = str(record.id)
        extraction.save(update_fields=["proposals"])
    return Status(201, record_out(request, record, access))


@router.post("/extractions/{extraction_id}/proposals/{index}/discard", response=ExtractionOut)
def discard_proposal(request, extraction_id: UUID, index: int):
    """Drop one line: nothing is written."""
    with transaction.atomic():
        extraction = _for_tutor(request, extraction_id, lock=True)
        proposal = _pending(extraction, index)
        proposal["review"] = "discarded"
        extraction.save(update_fields=["proposals"])
    return extraction_out(request, extraction)
