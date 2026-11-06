"""The notices a person was told, as the app lists them (ADR-0009)."""

from datetime import datetime
from uuid import UUID

from django.utils import timezone
from ninja import Router, Schema, Status
from ninja.errors import HttpError

from animals.models import Access
from reminders.models import Notice

router = Router(tags=["notices"])

# The app lists the latest notices only, and says so under the list.
LISTED = 50


class NoticeOut(Schema):
    id: UUID
    animal_id: UUID
    animal_name: str
    sent_at: datetime
    title: str
    body: str
    url: str
    read: bool


class UnreadOut(Schema):
    unread: bool


def visible(user):
    """The caller's notices about animals they can still open."""
    animals = Access.objects.valid(timezone.localdate()).filter(user=user).values("animal_id")
    return Notice.objects.filter(user=user, animal_id__in=animals)


@router.get("/notices", response=list[NoticeOut])
def list_notices(request):
    """The caller's latest 50 notices, newest first."""
    notices = visible(request.auth).select_related("animal").order_by("-created_at")[:LISTED]
    return [
        {
            "id": n.id,
            "animal_id": n.animal_id,
            "animal_name": n.animal.name,
            "sent_at": n.created_at,
            "title": n.title,
            "body": n.body,
            "url": n.path,
            "read": n.read_at is not None,
        }
        for n in notices
    ]


@router.get("/notices/unread", response=UnreadOut)
def get_unread(request):
    """Whether the caller has a notice not yet read: the dot on the tab."""
    return {"unread": visible(request.auth).filter(read_at__isnull=True).exists()}


@router.post("/notices/read", response={204: None})
def read_all_notices(request):
    """Mark every notice of the caller read."""
    visible(request.auth).filter(read_at__isnull=True).update(read_at=timezone.now())
    return Status(204, None)


@router.post("/notices/{notice_id}/read", response={204: None})
def read_notice(request, notice_id: UUID):
    """Mark one notice read (opened from the list or from a push)."""
    notice = visible(request.auth).filter(id=notice_id).first()
    if notice is None:
        raise HttpError(404, "Not Found")
    if notice.read_at is None:
        notice.read_at = timezone.now()
        notice.save(update_fields=["read_at"])
    return Status(204, None)
