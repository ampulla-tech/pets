"""The bytes of an attachment leave the storage with its row."""

from django.db.models.signals import post_delete
from django.dispatch import receiver

from animals.models import Attachment


@receiver(post_delete, sender=Attachment)
def delete_attachment_file(sender, instance: Attachment, **kwargs):
    if instance.file:
        instance.file.storage.delete(instance.file.name)
