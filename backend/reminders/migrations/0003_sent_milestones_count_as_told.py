"""Every milestone already in the old sending log counts as told, so the first
run on notices sends none of them again. No notice is written for them: the
app's list starts empty."""

from django.db import migrations


def forward(apps, schema_editor):
    Delivery = apps.get_model("reminders", "Delivery")
    NoticeItem = apps.get_model("reminders", "NoticeItem")
    sent = Delivery.objects.values_list("user_id", "reminder_key", "milestone").distinct()
    NoticeItem.objects.bulk_create(
        [NoticeItem(user_id=u, reminder_key=k, milestone=m, notice=None) for u, k, m in sent],
        ignore_conflicts=True,
    )
    Delivery.objects.all().delete()


class Migration(migrations.Migration):
    dependencies = [("reminders", "0002_notice")]

    operations = [migrations.RunPython(forward, migrations.RunPython.noop)]
