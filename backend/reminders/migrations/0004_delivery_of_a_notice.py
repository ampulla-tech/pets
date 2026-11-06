import django.db.models.deletion
from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [("reminders", "0003_sent_milestones_count_as_told")]

    operations = [
        migrations.RemoveConstraint(model_name="delivery", name="one_delivery_per_notice"),
        migrations.RemoveField(model_name="delivery", name="animal"),
        migrations.RemoveField(model_name="delivery", name="milestone"),
        migrations.RemoveField(model_name="delivery", name="reminder_key"),
        migrations.RemoveField(model_name="delivery", name="user"),
        migrations.AddField(
            model_name="delivery",
            name="notice",
            field=models.ForeignKey(
                on_delete=django.db.models.deletion.CASCADE,
                related_name="deliveries",
                to="reminders.notice",
            ),
            preserve_default=False,
        ),
        migrations.AddConstraint(
            model_name="delivery",
            constraint=models.UniqueConstraint(
                fields=("notice", "channel"), name="one_delivery_per_channel"
            ),
        ),
    ]
