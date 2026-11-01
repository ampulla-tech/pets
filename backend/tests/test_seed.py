import json

import pytest
from allauth.account.models import EmailAddress
from django.core.management import CommandError, call_command
from django.test import Client

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


def test_the_demo_account_is_already_confirmed_and_signs_in(db, settings):
    settings.DEBUG = True
    call_command("seed_demo")
    address = EmailAddress.objects.get(email="demo@example.com")
    assert address.verified and address.primary
    response = Client().post(
        "/_allauth/app/v1/auth/login",
        data=json.dumps({"email": "demo@example.com", "password": "pets-demo-2026"}),
        content_type="application/json",
    )
    assert response.status_code == 200
