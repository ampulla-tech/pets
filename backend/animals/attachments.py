"""Storing an uploaded file, and the signed link that serves it back.

A photo is normalised on the way in: EXIF rotation applied, EXIF dropped,
longest edge at most 2048 px, JPEG out. An iPhone writes HEIC, which
pillow-heif teaches Pillow to read. A PDF is kept as it came. Anything else is
refused.

The storage is never read through its own URLs. The API hands out a link to
its own file endpoint with a signature that expires, so an <img> tag or a PDF
viewer can open it without the session header, and the mechanism is the same
on disk and on a private bucket.
"""

import io
from collections.abc import Iterable

from django.conf import settings
from django.core import signing
from django.core.files.base import ContentFile
from ninja.errors import HttpError
from PIL import Image, ImageOps
from pillow_heif import register_heif_opener

from animals.models import Animal, Attachment

register_heif_opener()

MAX_EDGE = 2048
_SALT = "pets.attachment"
PDF = "application/pdf"


def normalise_image(raw: bytes) -> bytes:
    with Image.open(io.BytesIO(raw)) as image:
        image = ImageOps.exif_transpose(image)
        image.thumbnail((MAX_EDGE, MAX_EDGE))
        if image.mode not in ("RGB", "L"):
            image = image.convert("RGB")
        out = io.BytesIO()
        image.save(out, format="JPEG", quality=85, optimize=True)
        return out.getvalue()


def store_upload(animal: Animal, upload, user) -> Attachment:
    raw = upload.read()
    if len(raw) > settings.MAX_UPLOAD_BYTES:
        raise HttpError(413, "file too large")
    name = upload.name or "arquivo"
    content_type = (upload.content_type or "").lower()
    if content_type == PDF or name.lower().endswith(".pdf"):
        if not raw.startswith(b"%PDF"):
            raise HttpError(415, "not a PDF")
        data, content_type, extension = raw, PDF, "pdf"
    else:
        try:
            data = normalise_image(raw)
        except Exception as error:
            raise HttpError(415, "only photos and PDFs are accepted") from error
        content_type, extension = "image/jpeg", "jpg"
    attachment = Attachment(
        animal=animal,
        name=name,
        content_type=content_type,
        size=len(data),
        uploaded_by=user,
    )
    attachment.file.save(f"upload.{extension}", ContentFile(data), save=False)
    attachment.save()
    return attachment


def signed_url(request, attachment: Attachment) -> str:
    token = signing.TimestampSigner(salt=_SALT).sign(str(attachment.id))
    return request.build_absolute_uri(f"/files/{token}")


def resolve_signed(token: str) -> Attachment:
    try:
        attachment_id = signing.TimestampSigner(salt=_SALT).unsign(
            token, max_age=settings.FILE_LINK_MAX_AGE
        )
    except signing.BadSignature as error:
        raise HttpError(404, "Not Found") from error
    attachment = Attachment.objects.filter(id=attachment_id).first()
    if attachment is None:
        raise HttpError(404, "Not Found")
    return attachment


def owned_attachments(animal: Animal, ids: Iterable) -> list[Attachment]:
    ids = list(dict.fromkeys(str(i) for i in ids))
    found = list(Attachment.objects.filter(animal=animal, id__in=ids))
    if len(found) != len(ids):
        raise HttpError(422, "an attachment does not belong to this animal")
    return found


def delete_orphans(attachments: Iterable[Attachment]) -> None:
    """Delete the attachments nothing refers to any more."""
    from animals.models import RECORD_MODELS

    for attachment in attachments:
        used = Animal.objects.filter(photo=attachment).exists()
        for model in RECORD_MODELS.values():
            if used:
                break
            used = model.objects.filter(attachments=attachment).exists()
        if not used:
            from intake.models import Extraction

            used = Extraction.objects.filter(photos=attachment).exists()
        if not used:
            attachment.delete()
