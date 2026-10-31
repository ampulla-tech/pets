import json

import pytest
from django.test import Client

PASSWORD = "uma-senha-boa-42"


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
    api = Api()
    response = api.client.post(
        "/_allauth/app/v1/auth/signup",
        data=json.dumps({"email": email, "password": password}),
        content_type="application/json",
    )
    assert response.status_code == 200, response.content
    api.token = response.json()["meta"]["session_token"]
    return api


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
