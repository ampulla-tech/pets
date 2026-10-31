"""The app's own account: sign up, sign in on another device, sign out, reset."""

import json
import re

from django.core import mail
from django.test import Client

from conftest import PASSWORD, Api, signup


def post(client, path, body, token=None):
    headers = {"HTTP_X_SESSION_TOKEN": token} if token else {}
    return client.post(path, data=json.dumps(body), content_type="application/json", **headers)


def test_sign_up_answers_a_session_and_the_api_knows_the_person(db):
    api = signup("ana@example.com")
    me = api.get("/me")
    assert me.status_code == 200
    assert me.json()["email"] == "ana@example.com"


def test_the_same_account_signs_in_from_another_client(db):
    signup("ana@example.com")
    response = post(
        Client(),
        "/_allauth/app/v1/auth/login",
        {"email": "ana@example.com", "password": PASSWORD},
    )
    assert response.status_code == 200
    token = response.json()["meta"]["session_token"]
    assert Api(token).get("/me").json()["email"] == "ana@example.com"


def test_a_wrong_password_signs_nobody_in(db):
    signup("ana@example.com")
    response = post(
        Client(),
        "/_allauth/app/v1/auth/login",
        {"email": "ana@example.com", "password": "errada-errada"},
    )
    assert response.status_code == 400


def test_the_api_refuses_a_call_with_no_session(db):
    assert Api().get("/animals").status_code == 401


def test_sign_out_ends_the_session(db):
    api = signup("ana@example.com")
    response = api.client.delete("/_allauth/app/v1/auth/session", HTTP_X_SESSION_TOKEN=api.token)
    assert response.status_code == 401
    assert api.get("/me").status_code == 401


def test_the_password_is_reset_with_the_code_sent_by_email(db):
    signup("ana@example.com")
    client = Client()
    requested = post(client, "/_allauth/app/v1/auth/password/request", {"email": "ana@example.com"})
    assert requested.status_code == 401
    flow_token = requested.json()["meta"]["session_token"]
    assert len(mail.outbox) == 1
    code = re.search(r"\b([A-Z0-9]{4}-[A-Z0-9]{4})\b", mail.outbox[0].body).group(1)

    reset = post(
        client,
        "/_allauth/app/v1/auth/password/reset",
        {"key": code, "password": "outra-senha-boa-77"},
        token=flow_token,
    )
    assert reset.status_code == 200
    login = post(
        Client(),
        "/_allauth/app/v1/auth/login",
        {"email": "ana@example.com", "password": "outra-senha-boa-77"},
    )
    assert login.status_code == 200
