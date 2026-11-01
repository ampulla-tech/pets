"""The app's own account (ADR-0002): sign up with a confirmed e-mail, sign in,
sign out, reset; the native app with the session token, the web with the
session cookie and CSRF."""

import json

from allauth.account.models import EmailAddress
from django.core import mail
from django.test import Client

from conftest import BROWSER, PASSWORD, WEB, Api, Browser, browser_signup, last_code, signup

APP = "/_allauth/app/v1"
DOG = {"species": "dog", "name": "Bug", "sex": "male", "birth": {"precision": "unknown"}}


def post(client, path, body, token=None, **extra):
    headers = {"HTTP_X_SESSION_TOKEN": token} if token else {}
    return client.post(
        path, data=json.dumps(body), content_type="application/json", **headers, **extra
    )


# ── The native app: allauth's "app" client and its token ────────────────────


def test_sign_up_answers_a_session_and_the_api_knows_the_person(db):
    api = signup("ana@example.com")
    me = api.get("/me")
    assert me.status_code == 200
    assert me.json()["email"] == "ana@example.com"
    assert EmailAddress.objects.get(email="ana@example.com").verified


def test_sign_up_waits_for_the_emailed_code_before_the_account_is_usable(db):
    client = Client()
    response = post(
        client, f"{APP}/auth/signup", {"email": "ana@example.com", "password": PASSWORD}
    )
    assert response.status_code == 401
    body = response.json()
    assert {"id": "verify_email", "is_pending": True} in body["data"]["flows"]
    flow_token = body["meta"]["session_token"]
    assert Api(flow_token).get("/me").status_code == 401
    assert mail.outbox[-1].to == ["ana@example.com"]
    assert mail.outbox[-1].subject == "Pets: Seu código para confirmar o e-mail"

    wrong = post(client, f"{APP}/auth/email/verify", {"key": "BBBB-BBBB"}, token=flow_token)
    assert wrong.status_code == 400

    resent = post(client, f"{APP}/auth/email/verify/resend", {}, token=flow_token)
    assert resent.status_code == 200
    verified = post(
        client,
        f"{APP}/auth/email/verify",
        {"key": last_code("ana@example.com")},
        token=flow_token,
    )
    assert verified.status_code == 200
    token = verified.json()["meta"]["session_token"]
    assert Api(token).get("/me").json()["email"] == "ana@example.com"


def test_signing_in_before_confirming_sends_a_fresh_code(db):
    post(Client(), f"{APP}/auth/signup", {"email": "ana@example.com", "password": PASSWORD})
    sent = len(mail.outbox)
    client = Client()
    response = post(client, f"{APP}/auth/login", {"email": "ana@example.com", "password": PASSWORD})
    assert response.status_code == 401
    assert {"id": "verify_email", "is_pending": True} in response.json()["data"]["flows"]
    assert len(mail.outbox) == sent + 1
    verified = post(
        client,
        f"{APP}/auth/email/verify",
        {"key": last_code("ana@example.com")},
        token=response.json()["meta"]["session_token"],
    )
    assert verified.status_code == 200


def test_the_same_account_signs_in_from_another_client(db):
    signup("ana@example.com")
    response = post(
        Client(), f"{APP}/auth/login", {"email": "ana@example.com", "password": PASSWORD}
    )
    assert response.status_code == 200
    token = response.json()["meta"]["session_token"]
    assert Api(token).get("/me").json()["email"] == "ana@example.com"


def test_a_wrong_password_signs_nobody_in(db):
    signup("ana@example.com")
    response = post(
        Client(), f"{APP}/auth/login", {"email": "ana@example.com", "password": "errada-errada"}
    )
    assert response.status_code == 400


def test_the_api_refuses_a_call_with_no_session(db):
    assert Api().get("/animals").status_code == 401


def test_a_dead_token_answers_401_even_on_a_write(db):
    assert Api("not-a-session").post("/animals", DOG).status_code == 401


def test_sign_out_ends_the_session(db):
    api = signup("ana@example.com")
    response = api.client.delete(f"{APP}/auth/session", HTTP_X_SESSION_TOKEN=api.token)
    assert response.status_code == 401
    assert api.get("/me").status_code == 401


def test_the_password_is_reset_with_the_code_sent_by_email(db):
    signup("ana@example.com")
    client = Client()
    requested = post(client, f"{APP}/auth/password/request", {"email": "ana@example.com"})
    assert requested.status_code == 401
    flow_token = requested.json()["meta"]["session_token"]
    assert mail.outbox[-1].subject == "Pets: Seu código para criar uma senha nova"

    reset = post(
        client,
        f"{APP}/auth/password/reset",
        {"key": last_code("ana@example.com"), "password": "outra-senha-boa-77"},
        token=flow_token,
    )
    assert reset.status_code == 200
    login = post(
        Client(),
        f"{APP}/auth/login",
        {"email": "ana@example.com", "password": "outra-senha-boa-77"},
    )
    assert login.status_code == 200


# ── The web: allauth's "browser" client, the session cookie and CSRF ────────


def test_the_web_signs_up_confirms_and_calls_the_api_with_its_cookie(db):
    browser = browser_signup("ana@example.com")
    assert browser.get("/me").json()["email"] == "ana@example.com"
    assert browser.post("/animals", DOG).status_code == 201
    assert [a["name"] for a in browser.get("/animals").json()] == ["Bug"]


def test_a_cookie_write_without_the_csrf_header_is_refused(db):
    browser = browser_signup("ana@example.com")
    assert post(browser.client, "/animals", DOG).status_code == 403


def test_a_cookie_write_from_an_untrusted_origin_is_refused(db):
    browser = browser_signup("ana@example.com")
    response = browser.post("/animals", DOG, HTTP_ORIGIN="http://evil.example")
    assert response.status_code == 403


def test_the_web_cannot_sign_up_without_the_csrf_header(db):
    browser = Browser()
    response = post(
        browser.client, f"{BROWSER}/auth/signup", {"email": "ana@example.com", "password": PASSWORD}
    )
    assert response.status_code == 403


def test_the_web_signs_out(db):
    browser = browser_signup("ana@example.com")
    response = browser.client.delete(f"{BROWSER}/auth/session", **browser.csrf())
    assert response.status_code == 401
    assert browser.get("/me").status_code == 401


def test_the_web_resets_the_password_in_its_session(db):
    signup("ana@example.com")
    browser = Browser()
    requested = browser.post(f"{BROWSER}/auth/password/request", {"email": "ana@example.com"})
    assert requested.status_code == 401
    reset = browser.post(
        f"{BROWSER}/auth/password/reset",
        {"key": last_code("ana@example.com"), "password": "outra-senha-boa-77"},
    )
    assert reset.status_code == 200
    assert browser.get("/me").json()["email"] == "ana@example.com"


def test_the_api_answers_the_web_origin_with_credentials(db):
    response = Client().options(
        "/animals",
        HTTP_ORIGIN=WEB,
        HTTP_ACCESS_CONTROL_REQUEST_METHOD="POST",
        HTTP_ACCESS_CONTROL_REQUEST_HEADERS="x-csrftoken,content-type",
    )
    assert response["Access-Control-Allow-Origin"] == WEB
    assert response["Access-Control-Allow-Credentials"] == "true"
    assert "x-csrftoken" in response["Access-Control-Allow-Headers"]
