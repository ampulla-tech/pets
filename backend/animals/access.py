"""Who may do what to an animal (ADR-0006). Every route goes through here.

An animal the caller has no valid access to does not exist for them: 404, so
its existence never leaks. A caller with access but without the role an action
needs gets 403.
"""

from django.utils import timezone
from ninja.errors import HttpError

from animals.models import Access, Animal, Role


def access_to(user, animal_id) -> Access:
    access = (
        Access.objects.valid(timezone.localdate())
        .select_related("animal")
        .filter(animal_id=animal_id, user=user)
        .first()
    )
    if access is None:
        raise HttpError(404, "Not Found")
    return access


def readable(user, animal_id) -> Animal:
    return access_to(user, animal_id).animal


def as_tutor(user, animal_id) -> Animal:
    access = access_to(user, animal_id)
    if access.role != Role.TUTOR:
        raise HttpError(403, "only a tutor can do this")
    return access.animal


def tutors_of(animal: Animal):
    """The people a reminder about this animal goes to: its tutors, never a guest."""
    return [
        access.user
        for access in Access.objects.valid(timezone.localdate())
        .filter(animal=animal, role=Role.TUTOR, user__is_active=True)
        .select_related("user")
    ]
