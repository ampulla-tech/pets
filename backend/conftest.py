import json
import re

import pytest
from django.core import mail
from django.test import Client

PASSWORD = "uma-senha-boa-42"
CODE = re.compile(r"\b([A-Z0-9]{4}-[A-Z0-9]{4})\b")


def last_code(email: str, *, take: bool = False) -> str:
    """The code in the last message sent to `email` (verification or reset);
    with `take`, the message leaves the outbox once read."""
    message = next(m for m in reversed(mail.outbox) if email in m.to)
    if take:
        mail.outbox.remove(message)
    return CODE.search(message.body).group(1)


@pytest.fixture(autouse=True)
def _media(settings, tmp_path):
    settings.MEDIA_ROOT = tmp_path / "media"
    settings.STORAGES = {
        **settings.STORAGES,
        "staticfiles": {"BACKEND": "django.contrib.staticfiles.storage.StaticFilesStorage"},
    }
    settings.ACCOUNT_RATE_LIMITS = False


class Api:
    """A test client that speaks to the API the way the apps do: JSON and the
    session token header."""

    def __init__(self, token: str | None = None):
        self.client = Client()
        self.token = token

    def _headers(self):
        return {"HTTP_X_SESSION_TOKEN": self.token} if self.token else {}

    def _call(self, method, path, body=None, **extra):
        kwargs = {**self._headers(), **extra}
        if body is not None:
            kwargs["data"] = json.dumps(body, default=str)
            kwargs["content_type"] = "application/json"
        return getattr(self.client, method)(path, **kwargs)

    def get(self, path, **extra):
        return self._call("get", path, **extra)

    def post(self, path, body=None, **extra):
        return self._call("post", path, body if body is not None else {}, **extra)

    def put(self, path, body, **extra):
        return self._call("put", path, body, **extra)

    def delete(self, path, **extra):
        return self._call("delete", path, **extra)

    def upload(self, path, files, field="files"):
        return self.client.post(path, {field: files}, **self._headers())


def signup(email: str, password: str = PASSWORD) -> Api:
    """Sign up the way the native app does, confirming the e-mail with its code."""
    api = Api()
    response = api.client.post(
        "/_allauth/app/v1/auth/signup",
        data=json.dumps({"email": email, "password": password}),
        content_type="application/json",
    )
    assert response.status_code == 401, response.content
    flow_token = response.json()["meta"]["session_token"]
    response = api.client.post(
        "/_allauth/app/v1/auth/email/verify",
        # The verification mail is read and put away, so a test counting the
        # mail the app sends sees only its own.
        data=json.dumps({"key": last_code(email, take=True)}),
        content_type="application/json",
        HTTP_X_SESSION_TOKEN=flow_token,
    )
    assert response.status_code == 200, response.content
    api.token = response.json()["meta"]["session_token"]
    return api


BROWSER = "/_allauth/browser/v1"
WEB = "http://localhost:5180"


class Browser:
    """A client that speaks the way the web app does: the cookies the API set,
    and the CSRF cookie echoed as X-CSRFToken, from the web app's origin."""

    def __init__(self):
        self.client = Client(enforce_csrf_checks=True, HTTP_ORIGIN=WEB)
        # Any browser view answers with the CSRF cookie.
        self.client.get(f"{BROWSER}/auth/session")

    def csrf(self):
        return {"HTTP_X_CSRFTOKEN": self.client.cookies["csrftoken"].value}

    def post(self, path, body, **extra):
        return self.client.post(
            path,
            data=json.dumps(body),
            content_type="application/json",
            **{**self.csrf(), **extra},
        )

    def get(self, path):
        return self.client.get(path)


def browser_signup(email: str) -> Browser:
    browser = Browser()
    response = browser.post(f"{BROWSER}/auth/signup", {"email": email, "password": PASSWORD})
    assert response.status_code == 401
    assert "session_token" not in response.json()["meta"]
    verified = browser.post(f"{BROWSER}/auth/email/verify", {"key": last_code(email, take=True)})
    assert verified.status_code == 200, verified.content
    return browser


@pytest.fixture
def tutor(db):
    return signup("tutor@example.com")


@pytest.fixture
def other(db):
    return signup("other@example.com")


DOG = {
    "species": "dog",
    "name": "Bug",
    "breed": "Dachshund",
    "sex": "male",
    "birth": {"precision": "exact", "value": "2026-09-01"},
}
CAT = {
    "species": "cat",
    "name": "Lacan",
    "breed": "SRD",
    "sex": "male",
    "microchip": "000000000000000",
    "birth": {"precision": "unknown"},
}


def make_animal(api: Api, body=None) -> dict:
    response = api.post("/animals", body or DOG)
    assert response.status_code == 201, response.content
    return response.json()


def jpeg_bytes(size=(64, 48), color=(200, 120, 40)) -> bytes:
    import io

    from PIL import Image

    out = io.BytesIO()
    Image.new("RGB", size, color).save(out, format="JPEG")
    return out.getvalue()


def jpeg_file(name="foto.jpg"):
    from django.core.files.uploadedfile import SimpleUploadedFile

    return SimpleUploadedFile(name, jpeg_bytes(), content_type="image/jpeg")


def pdf_file(name="laudo.pdf"):
    from django.core.files.uploadedfile import SimpleUploadedFile

    return SimpleUploadedFile(name, b"%PDF-1.4\n%fake\n", content_type="application/pdf")


@pytest.fixture
def today(monkeypatch):
    """Fix the calendar day the API reasons with: `today(date(2026, 10, 31))`."""
    from django.utils import timezone

    def set_day(day):
        monkeypatch.setattr(timezone, "localdate", lambda *a, **k: day)
        return day

    return set_day


def pdf_text(content: bytes) -> list[str]:
    """The text a PDF made by reportlab draws, one string per text run."""
    import base64
    import zlib

    runs = []
    for match in re.finditer(rb"stream\r?\n(.*?)endstream", content, re.S):
        raw = match.group(1).strip()
        if raw.endswith(b"~>"):
            raw = base64.a85decode(raw[:-2])
        try:
            raw = zlib.decompress(raw)
        except zlib.error:
            continue
        for literal in re.findall(rb"\(((?:\\.|[^\\)])*)\)\s*Tj", raw, re.S):
            text = re.sub(
                rb"\\([0-7]{1,3}|.)",
                lambda m: bytes([int(m.group(1), 8)]) if m.group(1).isdigit() else m.group(1),
                literal,
            )
            runs.append(text.decode("cp1252"))
    return runs
