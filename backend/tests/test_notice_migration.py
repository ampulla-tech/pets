"""The change to kept notices: what the old sending log had counts as told."""

import pytest
from django.db import connection
from django.db.migrations.executor import MigrationExecutor

BEFORE = [("reminders", "0002_notice")]
AFTER = [("reminders", "0003_sent_milestones_count_as_told")]


@pytest.mark.django_db(transaction=True)
def test_every_milestone_in_the_old_log_becomes_an_item_with_no_notice():
    executor = MigrationExecutor(connection)
    executor.migrate(BEFORE)
    apps = executor.loader.project_state(BEFORE).apps
    User = apps.get_model("accounts", "User")
    Animal = apps.get_model("animals", "Animal")
    Delivery = apps.get_model("reminders", "Delivery")
    user = User.objects.create(email="tutor@example.com")
    animal = Animal.objects.create(species="cat", name="Lacan")
    for channel in ("email", "expo"):
        Delivery.objects.create(
            reminder_key="rabies:vaccine:x:2027-06-06",
            animal=animal,
            milestone="due",
            user=user,
            channel=channel,
        )

    executor = MigrationExecutor(connection)
    executor.migrate(AFTER)
    apps = executor.loader.project_state(AFTER).apps
    NoticeItem = apps.get_model("reminders", "NoticeItem")
    items = list(NoticeItem.objects.values_list("user_id", "reminder_key", "milestone", "notice"))
    assert items == [(user.id, "rabies:vaccine:x:2027-06-06", "due", None)]
    assert apps.get_model("reminders", "Delivery").objects.count() == 0

    MigrationExecutor(connection).migrate(MigrationExecutor(connection).loader.graph.leaf_nodes())
