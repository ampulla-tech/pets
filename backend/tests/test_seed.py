import pytest
from django.core.management import CommandError, call_command

from animals.models import Animal


def test_the_demo_seed_runs_twice_without_duplicating(db, settings):
    settings.DEBUG = True
    call_command("seed_demo", "--email", "demo@example.com")
    call_command("seed_demo", "--email", "demo@example.com")
    assert sorted(Animal.objects.values_list("name", flat=True)) == ["Bug", "GATA", "Lacan"]


def test_the_demo_seed_refuses_without_debug(db, settings):
    settings.DEBUG = False
    with pytest.raises(CommandError):
        call_command("seed_demo")
