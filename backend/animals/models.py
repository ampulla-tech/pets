"""The animal, who can see it (access), the invite, and its records.

An animal is shared with people through an Access (membership) with a role:
a tutor can do everything; a guest reads everything and writes only weights
and notes (ADR-0006). Every active animal keeps at least one tutor.

A Record is one thing that happened to the animal on a date. Its kinds are
separate tables sharing one abstract base: Vaccine, Antiparasitic, Weight,
Note and Visit. Every record keeps its author, its last edit, and attachments.
"""

import secrets
import uuid
from datetime import date, timedelta

from django.conf import settings
from django.db import models
from django.utils import timezone

INVITE_VALIDITY = timedelta(days=3)


class Species(models.TextChoices):
    DOG = "dog"
    CAT = "cat"


class Sex(models.TextChoices):
    MALE = "male"
    FEMALE = "female"


class BirthPrecision(models.TextChoices):
    EXACT = "exact"
    MONTH = "month"
    YEAR = "year"
    UNKNOWN = "unknown"


class AnimalStatus(models.TextChoices):
    ACTIVE = "active"
    ARCHIVED = "archived"


class ArchiveReason(models.TextChoices):
    DIED = "died"
    REHOMED = "rehomed"
    OTHER = "other"


class Role(models.TextChoices):
    TUTOR = "tutor"
    GUEST = "guest"


def attachment_path(instance: "Attachment", filename: str) -> str:
    extension = filename.rsplit(".", 1)[-1].lower() if "." in filename else "bin"
    return f"animals/{instance.animal_id}/{instance.id}.{extension}"


class Attachment(models.Model):
    """A photo or a PDF in the media storage, owned by one animal.

    One attachment can serve several records: the photo of a card page is
    attached to every record confirmed from it.
    """

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    animal = models.ForeignKey("Animal", on_delete=models.CASCADE, related_name="attachments")
    file = models.FileField(upload_to=attachment_path, max_length=255)
    name = models.CharField(max_length=255, blank=True)
    content_type = models.CharField(max_length=100)
    size = models.PositiveIntegerField(default=0)
    uploaded_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, null=True, on_delete=models.SET_NULL, related_name="+"
    )
    created_at = models.DateTimeField(auto_now_add=True)

    @property
    def is_image(self) -> bool:
        return self.content_type.startswith("image/")


class Animal(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    species = models.CharField(max_length=8, choices=Species.choices)
    name = models.CharField(max_length=80)
    breed = models.CharField(max_length=80, blank=True)
    sex = models.CharField(max_length=8, choices=Sex.choices, blank=True)
    neutered = models.BooleanField(null=True)
    coat = models.CharField(max_length=80, blank=True)
    microchip = models.CharField(max_length=40, blank=True)
    birth_precision = models.CharField(
        max_length=8, choices=BirthPrecision.choices, default=BirthPrecision.UNKNOWN
    )
    # The first day of the month or of the year when the precision is coarser.
    birth_date = models.DateField(null=True, blank=True)
    adopted_on = models.DateField(null=True, blank=True)
    photo = models.ForeignKey(
        Attachment, null=True, blank=True, on_delete=models.SET_NULL, related_name="+"
    )
    status = models.CharField(
        max_length=10, choices=AnimalStatus.choices, default=AnimalStatus.ACTIVE
    )
    archived_reason = models.CharField(max_length=10, choices=ArchiveReason.choices, blank=True)
    archived_on = models.DateField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self) -> str:
        return self.name


class AccessQuerySet(models.QuerySet):
    def valid(self, today: date | None = None):
        """Accesses that still hold: no end, or an end not yet passed."""
        today = today or timezone.localdate()
        return self.filter(models.Q(ends_on__isnull=True) | models.Q(ends_on__gte=today))


class Access(models.Model):
    """A person's access to an animal, with a role and an optional end."""

    animal = models.ForeignKey(Animal, on_delete=models.CASCADE, related_name="accesses")
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="accesses"
    )
    role = models.CharField(max_length=8, choices=Role.choices)
    # The last day the access holds; only a guest has one.
    ends_on = models.DateField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    objects = AccessQuerySet.as_manager()

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=["animal", "user"], name="one_access_per_person")
        ]


def new_invite_token() -> str:
    return secrets.token_urlsafe(24)


class Invite(models.Model):
    """A single-use link that grants access to one animal, valid for 3 days."""

    token = models.CharField(max_length=64, unique=True, default=new_invite_token)
    animal = models.ForeignKey(Animal, on_delete=models.CASCADE, related_name="invites")
    role = models.CharField(max_length=8, choices=Role.choices)
    access_ends_on = models.DateField(null=True, blank=True)
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="+"
    )
    created_at = models.DateTimeField(default=timezone.now)
    used_at = models.DateTimeField(null=True, blank=True)
    used_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="+",
    )

    @property
    def expires_at(self):
        return self.created_at + INVITE_VALIDITY

    def is_expired(self, now=None) -> bool:
        return (now or timezone.now()) >= self.expires_at


class RepeatOrigin(models.TextChoices):
    WRITTEN = "written"
    INFERRED = "inferred"


class Record(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    animal = models.ForeignKey(Animal, on_delete=models.CASCADE, related_name="%(class)s_records")
    date = models.DateField()
    attachments = models.ManyToManyField(Attachment, blank=True, related_name="%(class)s_records")
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, null=True, on_delete=models.SET_NULL, related_name="+"
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, null=True, on_delete=models.SET_NULL, related_name="+"
    )
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        abstract = True
        ordering = ["-date", "-created_at"]


class Vaccine(Record):
    brand = models.CharField(max_length=120, blank=True)
    lot = models.CharField(max_length=60, blank=True)
    # A month, YYYY-MM, or empty: the API refuses anything else (ADR-0010).
    lot_expiry = models.CharField(max_length=20, blank=True)
    diseases = models.JSONField(default=list)
    repeat_on = models.DateField(null=True, blank=True)
    repeat_on_origin = models.CharField(max_length=10, choices=RepeatOrigin.choices, blank=True)
    vet_name = models.CharField(max_length=120, blank=True)
    vet_crmv = models.CharField(max_length=40, blank=True)


class ParasiteKind(models.TextChoices):
    INTERNAL = "internal"
    EXTERNAL = "external"


class Weight(Record):
    kg = models.DecimalField(max_digits=6, decimal_places=3)


class Antiparasitic(Record):
    kind = models.CharField(max_length=10, choices=ParasiteKind.choices)
    product = models.CharField(max_length=120, blank=True)
    dose = models.CharField(max_length=60, blank=True)
    repeat_on = models.DateField(null=True, blank=True)
    repeat_on_origin = models.CharField(max_length=10, choices=RepeatOrigin.choices, blank=True)
    vet_name = models.CharField(max_length=120, blank=True)
    # The weight taken in the same step; deleting this record keeps the weight.
    weight = models.ForeignKey(
        Weight, null=True, blank=True, on_delete=models.SET_NULL, related_name="+"
    )


class Note(Record):
    text = models.TextField()


class Visit(Record):
    clinic = models.CharField(max_length=120, blank=True)
    vet_name = models.CharField(max_length=120, blank=True)
    reason = models.CharField(max_length=200, blank=True)
    notes = models.TextField(blank=True)


RECORD_MODELS: dict[str, type[Record]] = {
    "vaccine": Vaccine,
    "antiparasitic": Antiparasitic,
    "weight": Weight,
    "note": Note,
    "visit": Visit,
}
