"""The health probe answers the deploy (GET) and uptime monitors (HEAD)."""

from django.test import Client


def test_health_answers_get(db):
    response = Client().get("/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


def test_health_answers_head_without_a_body(db):
    response = Client().head("/health")
    assert response.status_code == 200
    assert response.content == b""
