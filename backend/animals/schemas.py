"""The API's request and response shapes for animals, accesses and records."""

from datetime import date, datetime
from decimal import Decimal
from typing import Annotated, Literal
from uuid import UUID

from ninja import Schema
from pydantic import Field

from animals.diseases import DiseaseCode


class ErrorOut(Schema):
    code: str
    detail: str


class BirthIn(Schema):
    precision: Literal["exact", "month", "year", "unknown"]
    # "2025-03-14" (exact), "2025-03" (month), "2025" (year), null (unknown).
    value: str | None = None


class BirthOut(Schema):
    precision: Literal["exact", "month", "year", "unknown"]
    value: str | None


class AgeOut(Schema):
    years: int
    months: int | None
    approximate: bool


class BadgeOut(Schema):
    state: Literal["none", "up_to_date", "due_soon", "overdue"]
    days: int | None = None


class LastWeightOut(Schema):
    kg: Decimal
    date: date


class AnimalIn(Schema):
    species: Literal["dog", "cat"]
    name: str = Field(min_length=1, max_length=80)
    breed: str = ""
    sex: Literal["male", "female", ""] = ""
    neutered: bool | None = None
    coat: str = ""
    microchip: str = ""
    birth: BirthIn = BirthIn(precision="unknown")
    adopted_on: date | None = None


class AnimalOut(Schema):
    id: UUID
    species: Literal["dog", "cat"]
    name: str
    breed: str
    sex: Literal["male", "female", ""]
    neutered: bool | None
    coat: str
    microchip: str
    birth: BirthOut
    adopted_on: date | None
    age: AgeOut | None
    photo_url: str | None
    status: Literal["active", "archived"]
    archived_reason: Literal["died", "rehomed", "other", ""]
    archived_on: date | None
    role: Literal["tutor", "guest"]
    badge: BadgeOut
    last_weight: LastWeightOut | None


class ArchiveIn(Schema):
    reason: Literal["died", "rehomed", "other"]
    on: date


class AttachmentOut(Schema):
    id: UUID
    name: str
    content_type: str
    url: str


class AuthorOut(Schema):
    id: UUID | None
    email: str | None


class RecordBase(Schema):
    id: UUID
    date: date
    attachments: list[AttachmentOut]
    created_by: AuthorOut
    created_at: datetime
    updated_by: AuthorOut
    updated_at: datetime
    can_edit: bool


class VaccineIn(Schema):
    date: date
    brand: str = ""
    lot: str = ""
    lot_expiry: str = ""
    diseases: list[DiseaseCode] = Field(min_length=1)
    repeat_on: date | None = None
    repeat_on_origin: Literal["written", "inferred", ""] = ""
    vet_name: str = ""
    vet_crmv: str = ""
    attachment_ids: list[UUID] = []


class VaccineOut(RecordBase):
    kind: Literal["vaccine"]
    brand: str
    lot: str
    lot_expiry: str
    diseases: list[DiseaseCode]
    repeat_on: date | None
    repeat_on_origin: Literal["written", "inferred", ""]
    vet_name: str
    vet_crmv: str


class AntiparasiticIn(Schema):
    date: date
    parasite: Literal["internal", "external"]
    product: str = ""
    dose: str = ""
    repeat_on: date | None = None
    repeat_on_origin: Literal["written", "inferred", ""] = ""
    vet_name: str = ""
    weight_kg: Decimal | None = Field(default=None, gt=0, max_digits=6, decimal_places=3)
    attachment_ids: list[UUID] = []


class AntiparasiticOut(RecordBase):
    kind: Literal["antiparasitic"]
    parasite: Literal["internal", "external"]
    product: str
    dose: str
    repeat_on: date | None
    repeat_on_origin: Literal["written", "inferred", ""]
    vet_name: str
    weight_kg: Decimal | None


class WeightIn(Schema):
    date: date
    kg: Decimal = Field(gt=0, max_digits=6, decimal_places=3)
    attachment_ids: list[UUID] = []


class WeightOut(RecordBase):
    kind: Literal["weight"]
    kg: Decimal


class NoteIn(Schema):
    date: date
    text: str = Field(min_length=1)
    attachment_ids: list[UUID] = []


class NoteOut(RecordBase):
    kind: Literal["note"]
    text: str


class VisitIn(Schema):
    date: date
    clinic: str = ""
    vet_name: str = ""
    reason: str = ""
    notes: str = ""
    attachment_ids: list[UUID] = []


class VisitOut(RecordBase):
    kind: Literal["visit"]
    clinic: str
    vet_name: str
    reason: str
    notes: str


RecordOut = Annotated[
    VaccineOut | AntiparasiticOut | WeightOut | NoteOut | VisitOut,
    Field(discriminator="kind"),
]


class AccessOut(Schema):
    id: int
    user_id: UUID
    email: str
    role: Literal["tutor", "guest"]
    ends_on: date | None
    is_me: bool


class InviteIn(Schema):
    role: Literal["tutor", "guest"]
    access_ends_on: date | None = None


class InviteOut(Schema):
    token: str
    url: str
    role: Literal["tutor", "guest"]
    access_ends_on: date | None
    expires_at: datetime


class InviteAnimalOut(Schema):
    name: str
    species: Literal["dog", "cat"]
    photo_url: str | None


class InvitePreviewOut(Schema):
    state: Literal["valid", "expired", "used"]
    role: Literal["tutor", "guest"]
    access_ends_on: date | None
    invited_by: str
    animal: InviteAnimalOut
    already_member: bool
    animal_id: UUID | None


class AcceptedOut(Schema):
    animal_id: UUID
    role: Literal["tutor", "guest"]
    ends_on: date | None


class CatalogEntry(Schema):
    code: str
    label: str


class CatalogOut(Schema):
    dog: list[CatalogEntry]
    cat: list[CatalogEntry]
    parasites: list[CatalogEntry]
