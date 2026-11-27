"""The lot expiries already stored become YYYY-MM, or the migration stops."""

import pytest
from django.db import connection
from django.db.migrations.executor import MigrationExecutor

BEFORE = [("animals", "0001_initial")]
AFTER = [("animals", "0002_lot_expiry_is_a_month")]


def _vaccines(*expiries):
    executor = MigrationExecutor(connection)
    executor.migrate(BEFORE)
    apps = executor.loader.project_state(BEFORE).apps
    Animal = apps.get_model("animals", "Animal")
    Vaccine = apps.get_model("animals", "Vaccine")
    animal = Animal.objects.create(species="cat", name="Lacan")
    return [
        Vaccine.objects.create(animal=animal, date="2026-10-05", diseases=["rabies"], lot_expiry=e)
        for e in expiries
    ]


def _expiries(vaccines):
    """The stored lot expiry of each vaccine, in the order they were created."""
    Vaccine = (
        MigrationExecutor(connection)
        .loader.project_state(AFTER)
        .apps.get_model("animals", "Vaccine")
    )
    stored = dict(Vaccine.objects.values_list("id", "lot_expiry"))
    return [stored[v.id] for v in vaccines]


def _to_the_latest():
    executor = MigrationExecutor(connection)
    executor.migrate(executor.loader.graph.leaf_nodes())


@pytest.mark.django_db(transaction=True)
def test_the_known_ways_of_writing_a_month_become_yyyy_mm():
    vaccines = _vaccines("09/2027", "9/2027", "2027-9", "2027-09", "", " 06/2027 ")

    MigrationExecutor(connection).migrate(AFTER)

    assert _expiries(vaccines) == ["2027-09", "2027-09", "2027-09", "2027-09", "", "2027-06"]
    _to_the_latest()


@pytest.mark.django_db(transaction=True)
def test_a_value_that_is_not_a_month_stops_the_migration_and_changes_nothing():
    vaccines = _vaccines("09/2027", "set 27", "13/2027")

    with pytest.raises(RuntimeError) as error:
        MigrationExecutor(connection).migrate(AFTER)

    message = str(error.value)
    assert f"{vaccines[1].id} 'set 27'" in message
    assert f"{vaccines[2].id} '13/2027'" in message
    assert str(vaccines[0].id) not in message
    assert _expiries(vaccines) == ["09/2027", "set 27", "13/2027"]

    Vaccine = (
        MigrationExecutor(connection)
        .loader.project_state(BEFORE)
        .apps.get_model("animals", "Vaccine")
    )
    Vaccine.objects.all().delete()
    _to_the_latest()
