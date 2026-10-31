"""Animals, their photo, their records, who has access, and invites."""

from datetime import date
from decimal import Decimal
from typing import Literal
from uuid import UUID

from allauth.headless.contrib.ninja.security import x_session_token_auth
from django.conf import settings
from django.db import transaction
from django.http import HttpResponse
from django.shortcuts import get_object_or_404
from django.utils import timezone
from django.utils.text import slugify
from ninja import File, Router, Schema, Status, UploadedFile
from ninja.errors import HttpError

from animals import attachments as storage
from animals.access import access_to, as_tutor, readable
from animals.age import age_of
from animals.card import card_pdf, card_rows
from animals.diseases import DISEASES, PARASITES, codes_for
from animals.errors import ApiError
from animals.models import (
    RECORD_MODELS,
    Access,
    Animal,
    AnimalStatus,
    Antiparasitic,
    Attachment,
    BirthPrecision,
    Invite,
    Note,
    Role,
    Vaccine,
    Visit,
    Weight,
)
from animals.schemas import (
    AcceptedOut,
    AccessOut,
    AnimalIn,
    AnimalOut,
    AntiparasiticIn,
    AntiparasiticOut,
    ArchiveIn,
    AttachmentOut,
    CatalogOut,
    ErrorOut,
    InviteIn,
    InviteOut,
    InvitePreviewOut,
    NoteIn,
    NoteOut,
    RecordOut,
    VaccineIn,
    VaccineOut,
    VisitIn,
    VisitOut,
    WeightIn,
    WeightOut,
)
from reminders.logic import badge_for
from reminders.service import reminders_of

router = Router()

# ── Serialisation ───────────────────────────────────────────────────────────


def _birth_value(animal: Animal) -> str | None:
    birth = animal.birth_date
    if birth is None:
        return None
    return {
        BirthPrecision.EXACT: birth.isoformat(),
        BirthPrecision.MONTH: birth.strftime("%Y-%m"),
        BirthPrecision.YEAR: str(birth.year),
    }.get(animal.birth_precision)


def _parse_birth(precision: str, value: str | None) -> date | None:
    if precision == BirthPrecision.UNKNOWN:
        return None
    if not value:
        raise HttpError(422, "a birth with a precision needs a value")
    try:
        if precision == BirthPrecision.EXACT:
            return date.fromisoformat(value)
        if precision == BirthPrecision.MONTH:
            year, month = value.split("-")
            return date(int(year), int(month), 1)
        return date(int(value), 1, 1)
    except ValueError as error:
        raise HttpError(422, "the birth value does not match its precision") from error


def attachment_out(request, attachment: Attachment) -> dict:
    return {
        "id": attachment.id,
        "name": attachment.name,
        "content_type": attachment.content_type,
        "url": storage.signed_url(request, attachment),
    }


def animal_out(request, animal: Animal, role: str, today: date | None = None) -> dict:
    today = today or timezone.localdate()
    age = age_of(animal.birth_precision, animal.birth_date, today)
    badge = badge_for(reminders_of(animal, today), today)
    last_weight = Weight.objects.filter(animal=animal).order_by("-date", "-created_at").first()
    return {
        "id": animal.id,
        "species": animal.species,
        "name": animal.name,
        "breed": animal.breed,
        "sex": animal.sex,
        "neutered": animal.neutered,
        "coat": animal.coat,
        "microchip": animal.microchip,
        "birth": {"precision": animal.birth_precision, "value": _birth_value(animal)},
        "adopted_on": animal.adopted_on,
        "age": age.__dict__ if age else None,
        "photo_url": storage.signed_url(request, animal.photo) if animal.photo else None,
        "status": animal.status,
        "archived_reason": animal.archived_reason,
        "archived_on": animal.archived_on,
        "role": role,
        "badge": {"state": badge.state, "days": badge.days},
        "last_weight": ({"kg": last_weight.kg, "date": last_weight.date} if last_weight else None),
    }


def _kg(value) -> Decimal | None:
    return None if value is None else Decimal(value).quantize(Decimal("0.001"))


def _author(user) -> dict:
    return {"id": user.id if user else None, "email": user.email if user else None}


def _can_edit(record, access: Access) -> bool:
    if access.role == Role.TUTOR:
        return True
    return isinstance(record, Weight | Note) and record.created_by_id == access.user_id


def record_out(request, record, access: Access) -> dict:
    base = {
        "id": record.id,
        "date": record.date,
        "attachments": [attachment_out(request, a) for a in record.attachments.all()],
        "created_by": _author(record.created_by),
        "created_at": record.created_at,
        "updated_by": _author(record.updated_by),
        "updated_at": record.updated_at,
        "can_edit": _can_edit(record, access),
    }
    if isinstance(record, Vaccine):
        return base | {
            "kind": "vaccine",
            "brand": record.brand,
            "lot": record.lot,
            "lot_expiry": record.lot_expiry,
            "diseases": record.diseases,
            "repeat_on": record.repeat_on,
            "repeat_on_origin": record.repeat_on_origin,
            "vet_name": record.vet_name,
            "vet_crmv": record.vet_crmv,
        }
    if isinstance(record, Antiparasitic):
        return base | {
            "kind": "antiparasitic",
            "parasite": record.kind,
            "product": record.product,
            "dose": record.dose,
            "repeat_on": record.repeat_on,
            "repeat_on_origin": record.repeat_on_origin,
            "vet_name": record.vet_name,
            "weight_kg": _kg(record.weight.kg) if record.weight else None,
        }
    if isinstance(record, Weight):
        return base | {"kind": "weight", "kg": _kg(record.kg)}
    if isinstance(record, Note):
        return base | {"kind": "note", "text": record.text}
    return base | {
        "kind": "visit",
        "clinic": record.clinic,
        "vet_name": record.vet_name,
        "reason": record.reason,
        "notes": record.notes,
    }


# ── Catalog ─────────────────────────────────────────────────────────────────


@router.get("/catalog", response=CatalogOut, auth=None, tags=["catalog"])
def get_catalog(request):
    """The closed lists: diseases per species and the antiparasitic kinds."""

    def entries(items):
        return [{"code": code, "label": label} for code, label in items]

    return {
        "dog": entries(DISEASES["dog"]),
        "cat": entries(DISEASES["cat"]),
        "parasites": entries(PARASITES),
    }


# ── Animals ─────────────────────────────────────────────────────────────────


def _apply(animal: Animal, payload: AnimalIn) -> None:
    animal.species = payload.species
    animal.name = payload.name.strip()
    animal.breed = payload.breed.strip()
    animal.sex = payload.sex
    animal.neutered = payload.neutered
    animal.coat = payload.coat.strip()
    animal.microchip = payload.microchip.strip()
    animal.birth_precision = payload.birth.precision
    animal.birth_date = _parse_birth(payload.birth.precision, payload.birth.value)
    animal.adopted_on = payload.adopted_on


@router.get("/animals", response=list[AnimalOut], tags=["animals"])
def list_animals(request, status: str = "active"):
    """The caller's animals, active by default, or the archived ones."""
    accesses = (
        Access.objects.valid()
        .filter(user=request.auth, animal__status=status)
        .select_related("animal", "animal__photo")
        .order_by("animal__name")
    )
    today = timezone.localdate()
    return [animal_out(request, a.animal, a.role, today) for a in accesses]


@router.post("/animals", response={201: AnimalOut}, tags=["animals"])
def create_animal(request, payload: AnimalIn):
    """Register an animal; whoever registers it becomes its first tutor."""
    with transaction.atomic():
        animal = Animal()
        _apply(animal, payload)
        animal.save()
        Access.objects.create(animal=animal, user=request.auth, role=Role.TUTOR)
    return Status(201, animal_out(request, animal, Role.TUTOR))


@router.get("/animals/{animal_id}", response=AnimalOut, tags=["animals"])
def get_animal(request, animal_id: UUID):
    access = access_to(request.auth, animal_id)
    return animal_out(request, access.animal, access.role)


@router.put("/animals/{animal_id}", response=AnimalOut, tags=["animals"])
def update_animal(request, animal_id: UUID, payload: AnimalIn):
    animal = as_tutor(request.auth, animal_id)
    if payload.species != animal.species and _has_vaccines(animal):
        raise HttpError(422, "the species of an animal with vaccines cannot change")
    _apply(animal, payload)
    animal.save()
    return animal_out(request, animal, Role.TUTOR)


def _has_vaccines(animal: Animal) -> bool:
    return Vaccine.objects.filter(animal=animal).exists()


@router.post("/animals/{animal_id}/photo", response=AnimalOut, tags=["animals"])
def set_animal_photo(request, animal_id: UUID, file: File[UploadedFile]):
    animal = as_tutor(request.auth, animal_id)
    previous = animal.photo
    if not file.content_type or not file.content_type.startswith("image/"):
        if not (file.name or "").lower().endswith((".heic", ".heif")):
            raise HttpError(415, "the animal's photo must be an image")
    animal.photo = storage.store_upload(animal, file, request.auth)
    animal.save(update_fields=["photo"])
    if previous:
        storage.delete_orphans([previous])
    return animal_out(request, animal, Role.TUTOR)


@router.post("/animals/{animal_id}/archive", response=AnimalOut, tags=["animals"])
def archive_animal(request, animal_id: UUID, payload: ArchiveIn):
    """Archive with a reason and a date: off the home screen, reminders suspended."""
    animal = as_tutor(request.auth, animal_id)
    animal.status = AnimalStatus.ARCHIVED
    animal.archived_reason = payload.reason
    animal.archived_on = payload.on
    animal.save(update_fields=["status", "archived_reason", "archived_on"])
    return animal_out(request, animal, Role.TUTOR)


@router.delete("/animals/{animal_id}", response={204: None}, tags=["animals"])
def delete_animal(request, animal_id: UUID):
    """Delete for good: the animal, its records and its files."""
    animal = as_tutor(request.auth, animal_id)
    with transaction.atomic():
        Animal.objects.filter(pk=animal.pk).update(photo=None)
        animal.delete()
    return Status(204, None)


# ── Attachments ─────────────────────────────────────────────────────────────


@router.post(
    "/animals/{animal_id}/attachments",
    response={201: list[AttachmentOut]},
    tags=["attachments"],
)
def upload_attachments(request, animal_id: UUID, files: File[list[UploadedFile]]):
    """Store photos or PDFs, to be referred to by records through their ids."""
    animal = as_tutor(request.auth, animal_id)
    stored = [storage.store_upload(animal, upload, request.auth) for upload in files]
    return Status(201, [attachment_out(request, a) for a in stored])


# ── Records ─────────────────────────────────────────────────────────────────


def _check_diseases(animal: Animal, diseases: list[str]) -> list[str]:
    allowed = set(codes_for(animal.species))
    wrong = [code for code in diseases if code not in allowed]
    if wrong:
        raise HttpError(422, f"not a disease of this species: {', '.join(wrong)}")
    return list(dict.fromkeys(diseases))


def _write_permission(access: Access, model, record=None) -> None:
    if access.role == Role.TUTOR:
        return
    if model in (Weight, Note) and (record is None or record.created_by_id == access.user_id):
        return
    raise HttpError(403, "a guest writes only weights and notes")


def _set_attachments(record, animal, ids, user) -> None:
    if ids:
        if not access_to(user, animal.id).role == Role.TUTOR:
            raise HttpError(403, "only a tutor attaches files")
        record.attachments.set(storage.owned_attachments(animal, ids))
    else:
        record.attachments.clear()


def _fill_vaccine(record: Vaccine, animal: Animal, payload: VaccineIn) -> None:
    record.date = payload.date
    record.brand = payload.brand.strip()
    record.lot = payload.lot.strip()
    record.lot_expiry = payload.lot_expiry.strip()
    record.diseases = _check_diseases(animal, payload.diseases)
    record.repeat_on = payload.repeat_on
    record.repeat_on_origin = payload.repeat_on_origin if payload.repeat_on else ""
    record.vet_name = payload.vet_name.strip()
    record.vet_crmv = payload.vet_crmv.strip()


def _fill_antiparasitic(record: Antiparasitic, animal: Animal, payload: AntiparasiticIn, user):
    record.date = payload.date
    record.kind = payload.parasite
    record.product = payload.product.strip()
    record.dose = payload.dose.strip()
    record.repeat_on = payload.repeat_on
    record.repeat_on_origin = payload.repeat_on_origin if payload.repeat_on else ""
    record.vet_name = payload.vet_name.strip()
    if payload.weight_kg is None:
        record.weight = None
    elif record.weight is not None:
        record.weight.kg = payload.weight_kg
        record.weight.date = payload.date
        record.weight.updated_by = user
        record.weight.save()
    else:
        record.weight = Weight.objects.create(
            animal=animal,
            date=payload.date,
            kg=payload.weight_kg,
            created_by=user,
            updated_by=user,
        )


def _fill(model, record, animal, payload, user) -> None:
    if model is Vaccine:
        _fill_vaccine(record, animal, payload)
    elif model is Antiparasitic:
        _fill_antiparasitic(record, animal, payload, user)
    elif model is Weight:
        record.date, record.kg = payload.date, payload.kg
    elif model is Note:
        record.date, record.text = payload.date, payload.text.strip()
    else:
        record.date = payload.date
        record.clinic = payload.clinic.strip()
        record.vet_name = payload.vet_name.strip()
        record.reason = payload.reason.strip()
        record.notes = payload.notes.strip()


def create_record(request, animal_id, model, payload, extra_attachments=()):
    access = access_to(request.auth, animal_id)
    _write_permission(access, model)
    animal = access.animal
    if animal.status != AnimalStatus.ACTIVE:
        raise HttpError(409, "an archived animal is read-only")
    with transaction.atomic():
        record = model(animal=animal, created_by=request.auth, updated_by=request.auth)
        _fill(model, record, animal, payload, request.auth)
        record.save()
        ids = [*payload.attachment_ids, *(a.id for a in extra_attachments)]
        if ids:
            _set_attachments(record, animal, ids, request.auth)
    return record, access


def update_record(request, animal_id, model, record_id, payload):
    access = access_to(request.auth, animal_id)
    animal = access.animal
    record = get_object_or_404(model, animal=animal, id=record_id)
    _write_permission(access, model, record)
    if animal.status != AnimalStatus.ACTIVE:
        raise HttpError(409, "an archived animal is read-only")
    with transaction.atomic():
        before = list(record.attachments.all())
        _fill(model, record, animal, payload, request.auth)
        record.updated_by = request.auth
        record.save()
        _set_attachments(record, animal, payload.attachment_ids, request.auth)
        storage.delete_orphans(a for a in before if a.id not in set(payload.attachment_ids))
    return record, access


def delete_record(request, animal_id, model, record_id) -> None:
    access = access_to(request.auth, animal_id)
    record = get_object_or_404(model, animal=access.animal, id=record_id)
    _write_permission(access, model, record)
    with transaction.atomic():
        attached = list(record.attachments.all())
        record.delete()
        storage.delete_orphans(attached)


def _register(kind: str, plural: str, model, schema_in, schema_out) -> None:
    def create(request, animal_id: UUID, payload: schema_in):
        record, access = create_record(request, animal_id, model, payload)
        return Status(201, record_out(request, record, access))

    def update(request, animal_id: UUID, record_id: UUID, payload: schema_in):
        record, access = update_record(request, animal_id, model, record_id, payload)
        return record_out(request, record, access)

    def delete(request, animal_id: UUID, record_id: UUID):
        delete_record(request, animal_id, model, record_id)
        return Status(204, None)

    tags = ["records"]
    router.post(
        f"/animals/{{animal_id}}/{plural}",
        response={201: schema_out},
        operation_id=f"create_{kind}",
        tags=tags,
    )(create)
    router.put(
        f"/animals/{{animal_id}}/{plural}/{{record_id}}",
        response=schema_out,
        operation_id=f"update_{kind}",
        tags=tags,
    )(update)
    router.delete(
        f"/animals/{{animal_id}}/{plural}/{{record_id}}",
        response={204: None},
        operation_id=f"delete_{kind}",
        tags=tags,
    )(delete)


_register("vaccine", "vaccines", Vaccine, VaccineIn, VaccineOut)
_register("antiparasitic", "antiparasitics", Antiparasitic, AntiparasiticIn, AntiparasiticOut)
_register("weight", "weights", Weight, WeightIn, WeightOut)
_register("note", "notes", Note, NoteIn, NoteOut)
_register("visit", "visits", Visit, VisitIn, VisitOut)


@router.get("/animals/{animal_id}/records", response=list[RecordOut], tags=["records"])
def list_records(request, animal_id: UUID):
    """The animal's history, every kind together, newest first."""
    access = access_to(request.auth, animal_id)
    records = []
    for model in RECORD_MODELS.values():
        queryset = (
            model.objects.filter(animal=access.animal)
            .select_related("created_by", "updated_by")
            .prefetch_related("attachments")
        )
        if model is Antiparasitic:
            queryset = queryset.select_related("weight")
        records.extend(queryset)
    records.sort(key=lambda r: (r.date, r.created_at), reverse=True)
    return [record_out(request, r, access) for r in records]


# ── Accesses ────────────────────────────────────────────────────────────────


@router.get("/animals/{animal_id}/accesses", response=list[AccessOut], tags=["people"])
def list_accesses(request, animal_id: UUID):
    """Who has access to the animal, and with which role."""
    animal = readable(request.auth, animal_id)
    accesses = Access.objects.valid().filter(animal=animal).select_related("user")
    order = {Role.TUTOR: 0, Role.GUEST: 1}
    return sorted(
        (
            {
                "id": a.id,
                "user_id": a.user_id,
                "email": a.user.email,
                "role": a.role,
                "ends_on": a.ends_on,
                "is_me": a.user_id == request.auth.id,
            }
            for a in accesses
        ),
        key=lambda a: (order[a["role"]], a["email"]),
    )


@router.delete(
    "/animals/{animal_id}/accesses/{access_id}",
    response={204: None, 409: ErrorOut},
    tags=["people"],
)
def remove_access(request, animal_id: UUID, access_id: int):
    """Remove someone (a tutor), or leave (anyone, their own access).

    The last tutor of an animal can neither leave nor be removed: the animal
    would be left with nobody responsible for it.
    """
    mine = access_to(request.auth, animal_id)
    with transaction.atomic():
        target = get_object_or_404(
            Access.objects.select_for_update(), id=access_id, animal_id=animal_id
        )
        if target.user_id != request.auth.id and mine.role != Role.TUTOR:
            raise HttpError(403, "only a tutor removes people")
        if target.role == Role.TUTOR:
            tutors = (
                Access.objects.valid()
                .select_for_update()
                .filter(animal_id=animal_id, role=Role.TUTOR)
                .count()
            )
            if tutors <= 1:
                raise ApiError(
                    409,
                    "last_tutor",
                    "the last tutor cannot leave: invite another tutor or delete the animal",
                )
        target.delete()
    return Status(204, None)


# ── Invites ─────────────────────────────────────────────────────────────────


def invite_url(token: str) -> str:
    return f"{settings.WEB_APP_URL}/convite/{token}"


@router.post("/animals/{animal_id}/invites", response={201: InviteOut}, tags=["people"])
def create_invite(request, animal_id: UUID, payload: InviteIn):
    """A single-use link, valid for 3 days, that grants a role on this animal."""
    animal = as_tutor(request.auth, animal_id)
    if payload.role == Role.TUTOR and payload.access_ends_on:
        raise HttpError(422, "a tutor's access has no end")
    if payload.access_ends_on and payload.access_ends_on < timezone.localdate():
        raise HttpError(422, "the access cannot end in the past")
    invite = Invite.objects.create(
        animal=animal,
        role=payload.role,
        access_ends_on=payload.access_ends_on,
        created_by=request.auth,
    )
    return Status(
        201,
        {
            "token": invite.token,
            "url": invite_url(invite.token),
            "role": invite.role,
            "access_ends_on": invite.access_ends_on,
            "expires_at": invite.expires_at,
        },
    )


def _invite_state(invite: Invite) -> str:
    if invite.used_at:
        return "used"
    if invite.is_expired():
        return "expired"
    return "valid"


class _Optional:
    """Authentication that lets an anonymous caller through, as None."""

    def __call__(self, request):
        return True


@router.get(
    "/invites/{token}",
    response=InvitePreviewOut,
    auth=[x_session_token_auth, _Optional()],
    tags=["people"],
)
def preview_invite(request, token: str):
    """What the invite grants, shown before accepting (open to a caller with no account)."""
    invite = get_object_or_404(
        Invite.objects.select_related("animal", "animal__photo", "created_by"), token=token
    )
    user = getattr(request, "auth", None)
    user = user if getattr(user, "is_authenticated", False) else None
    member = bool(user and Access.objects.valid().filter(animal=invite.animal, user=user).exists())
    animal = invite.animal
    return {
        "state": _invite_state(invite),
        "role": invite.role,
        "access_ends_on": invite.access_ends_on,
        "invited_by": invite.created_by.email,
        "animal": {
            "name": animal.name,
            "species": animal.species,
            "photo_url": storage.signed_url(request, animal.photo) if animal.photo else None,
        },
        "already_member": member,
        "animal_id": animal.id if member else None,
    }


@router.post(
    "/invites/{token}/accept",
    response={200: AcceptedOut, 409: ErrorOut, 410: ErrorOut},
    tags=["people"],
)
def accept_invite(request, token: str):
    """Accept: the access is created with the invite's role and end, and the invite is spent."""
    with transaction.atomic():
        invite = get_object_or_404(Invite.objects.select_for_update(), token=token)
        if invite.used_at:
            raise ApiError(409, "invite_used", "this invite has already been used")
        if invite.is_expired():
            raise ApiError(410, "invite_expired", "this invite has expired")
        existing = Access.objects.filter(animal=invite.animal, user=request.auth).first()
        if existing and existing in Access.objects.valid():
            raise ApiError(409, "already_member", "you already have access to this animal")
        if existing:
            existing.delete()
        access = Access.objects.create(
            animal=invite.animal,
            user=request.auth,
            role=invite.role,
            ends_on=invite.access_ends_on if invite.role == Role.GUEST else None,
        )
        invite.used_at = timezone.now()
        invite.used_by = request.auth
        invite.save(update_fields=["used_at", "used_by"])
    return Status(
        200, {"animal_id": access.animal_id, "role": access.role, "ends_on": access.ends_on}
    )


# ── The card ────────────────────────────────────────────────────────────────


class CardRowOut(Schema):
    subject: str
    label: str
    last_date: date
    last_product: str
    last_vet: str
    next_on: date | None
    state: str
    record_kind: Literal["vaccine", "antiparasitic"]
    record_id: UUID
    photos: list[AttachmentOut]


class CardOut(Schema):
    animal: AnimalOut
    rows: list[CardRowOut]


@router.get("/animals/{animal_id}/card", response=CardOut, tags=["card"])
def get_card(request, animal_id: UUID):
    """The card to show at the clinic's counter: one row per disease, last and next dose."""
    access = access_to(request.auth, animal_id)
    rows = card_rows(access.animal)
    return {
        "animal": animal_out(request, access.animal, access.role),
        "rows": [
            {
                **{k: v for k, v in row.__dict__.items() if k != "photos"},
                "photos": [attachment_out(request, p) for p in row.photos],
            }
            for row in rows
        ],
    }


@router.get("/animals/{animal_id}/card.pdf", include_in_schema=False)
def get_card_pdf(request, animal_id: UUID):
    """The card as a PDF, with the label photos, for whoever has access."""
    animal = access_to(request.auth, animal_id).animal
    response = HttpResponse(card_pdf(animal), content_type="application/pdf")
    filename = slugify(animal.name) or "animal"
    response["Content-Disposition"] = f'attachment; filename="carteirinha-{filename}.pdf"'
    return response
