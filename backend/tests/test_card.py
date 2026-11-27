"""The card for the clinic's counter, and its PDF: only for whoever has access."""

from datetime import date

import pytest

from animals.models import Vaccine
from conftest import CAT, DOG, LABEL, jpeg_file, make_animal, pdf_text

FELINE = ["rhinotracheitis", "calicivirus", "panleukopenia", "chlamydiosis"]


@pytest.fixture
def gata(tutor, today):
    today(date(2026, 10, 31))
    cat = make_animal(tutor, {**CAT, "name": "GATA", "sex": "female"})
    photo = tutor.upload(f"/animals/{cat['id']}/attachments", [jpeg_file()]).json()[0]["id"]
    for body in (
        {
            "date": "2025-07-03",
            "brand": "Nobivac Raiva",
            "diseases": ["rabies"],
            "repeat_on": "2026-07-03",
        },
        {
            "date": "2025-07-03",
            "brand": "Nobivac Feline 1-HCPCh+FeLV",
            "diseases": [*FELINE, "felv"],
            "repeat_on": "2025-07-24",
        },
        {
            "date": "2025-07-28",
            "brand": "Nobivac Feline 1-HCPCh+FeLV",
            "diseases": [*FELINE, "felv"],
            "repeat_on": "2026-07-28",
        },
        {
            "date": "2026-10-05",
            "brand": "Felocell FeLV",
            "diseases": ["felv"],
            "repeat_on": "2027-10-05",
        },
        {
            "date": "2026-10-05",
            "brand": "Felocell CVR-C",
            "diseases": FELINE,
            "repeat_on": "2027-10-05",
            "attachment_ids": [photo],
        },
        {
            "date": "2026-10-05",
            "brand": "Rabmune",
            "diseases": ["rabies"],
            "repeat_on": "2027-10-05",
            "vet_name": "Dra. Exemplo",
        },
    ):
        assert tutor.post(f"/animals/{cat['id']}/vaccines", {**LABEL, **body}).status_code == 201
    return cat


VANGUARD = ["distemper", "infectious_hepatitis", "parvovirus", "parainfluenza", "leptospirosis"]


@pytest.fixture
def pacoca(tutor, today):
    """The PRD's example: two doses of each, a visit, a weight and a note."""
    today(date(2026, 11, 6))
    dog = make_animal(tutor, {**DOG, "name": "Paçoca"})
    base = f"/animals/{dog['id']}"
    files = tutor.upload(f"{base}/attachments", [jpeg_file(), jpeg_file("b.jpg")]).json()
    for path, body in (
        (
            "vaccines",
            {
                "date": "2024-11-06",
                "brand": "Vanguard Plus",
                "diseases": VANGUARD,
                "repeat_on": "2025-11-06",
            },
        ),
        (
            "vaccines",
            {
                "date": "2025-11-06",
                "brand": "Vanguard Plus",
                "diseases": VANGUARD,
                "repeat_on": "2026-11-06",
                "lot": "123A",
                "vet_name": "Dra. Lima",
            },
        ),
        (
            "vaccines",
            {
                "date": "2025-03-02",
                "brand": "Rabmune",
                "diseases": ["rabies"],
                "repeat_on": "2026-03-02",
            },
        ),
        (
            "vaccines",
            {
                "date": "2026-03-10",
                "brand": "Rabmune",
                "diseases": ["rabies"],
                "repeat_on": "2027-03-10",
                "lot": "R88",
                "vet_name": "Dr. Souza",
            },
        ),
        (
            "antiparasitics",
            {
                "date": "2026-05-02",
                "parasite": "internal",
                "product": "Drontal Plus",
                "repeat_on": "2026-08-01",
            },
        ),
        (
            "antiparasitics",
            {
                "date": "2026-08-01",
                "parasite": "internal",
                "product": "Drontal Plus",
                "repeat_on": "2026-11-01",
                "weight_kg": "8.1",
            },
        ),
        (
            "visits",
            {
                "date": "2026-03-12",
                "clinic": "Clínica Vida Animal",
                "reason": "Check-up anual",
                "vet_name": "Dr. Souza",
                "attachment_ids": [f["id"] for f in files],
            },
        ),
        ("weights", {"date": "2026-11-06", "kg": "8.4"}),
        ("notes", {"date": "2026-10-20", "text": "Coçando a orelha esquerda desde ontem."}),
    ):
        if path != "vaccines":
            assert tutor.post(f"{base}/{path}", body).status_code == 201
            continue
        response = tutor.post(f"{base}/{path}", {**LABEL, **body})
        assert response.status_code == 201
        # Doses saved before ADR-0011: what the example leaves out stays empty.
        Vaccine.objects.filter(id=response.json()["id"]).update(
            **{field: "" for field in LABEL if field not in body}
        )
    return dog


def lines(section):
    return [
        (
            i["title"],
            i["date"],
            i["detail"],
            i["current"],
            i["repeat_on"],
            i["state"],
            i["due_in_days"],
        )
        for i in section["items"]
    ]


def test_the_card_has_a_line_per_record_in_a_section_per_kind(tutor, pacoca):
    card = tutor.get(f"/animals/{pacoca['id']}/card").json()
    sections = {s["kind"]: s for s in card["sections"]}
    assert list(sections) == ["vaccine", "antiparasitic", "visit", "weight", "note"]
    assert lines(sections["vaccine"]) == [
        ("Rabmune", "2026-03-10", "Partida R88 · Dr. Souza", True, "2027-03-10", "ok", 124),
        (
            "Vanguard Plus",
            "2025-11-06",
            "Partida 123A · Dra. Lima",
            True,
            "2026-11-06",
            "due_soon",
            0,
        ),
        ("Rabmune", "2025-03-02", "", False, None, None, None),
        ("Vanguard Plus", "2024-11-06", "", False, None, None, None),
    ]
    assert lines(sections["antiparasitic"]) == [
        ("Drontal Plus", "2026-08-01", "Verme interno · 8,1 kg", True, "2026-11-01", "overdue", -5),
        ("Drontal Plus", "2026-05-02", "Verme interno", False, None, None, None),
    ]
    assert lines(sections["visit"]) == [
        (
            "Clínica Vida Animal",
            "2026-03-12",
            "Check-up anual · Dr. Souza · 2 arquivos",
            False,
            None,
            None,
            None,
        ),
    ]
    assert [(i["title"], i["date"], i["detail"]) for i in sections["weight"]["items"]] == [
        ("8,4 kg", "2026-11-06", ""),
        ("8,1 kg", "2026-08-01", "Com o Drontal Plus"),
    ]
    assert [(i["title"], i["detail"]) for i in sections["note"]["items"]] == [
        ("Coçando a orelha esquerda desde ontem.", "tutor@example.com"),
    ]
    assert all(i["can_edit"] for s in card["sections"] for i in s["items"])
    assert card["animal"]["name"] == "Paçoca"


def test_a_vaccine_with_no_brand_is_named_by_its_diseases_and_a_dose_with_no_date_says_so(
    tutor, today
):
    today(date(2026, 11, 6))
    dog = make_animal(tutor)
    body = {**LABEL, "date": "2026-09-20", "diseases": ["rabies", "distemper"]}
    assert tutor.post(f"/animals/{dog['id']}/vaccines", body).status_code == 201
    # Saved before the brand was required (ADR-0011).
    Vaccine.objects.update(brand="")
    card = tutor.get(f"/animals/{dog['id']}/card").json()
    [item] = card["sections"][0]["items"]
    assert (item["title"], item["current"], item["repeat_on"], item["state"]) == (
        "Raiva, Cinomose",
        True,
        None,
        "no_date",
    )


def test_an_animal_with_nothing_recorded_has_an_empty_card(tutor):
    dog = make_animal(tutor)
    assert tutor.get(f"/animals/{dog['id']}/card").json()["sections"] == []


def test_a_guest_reads_the_whole_card_and_opens_only_what_they_wrote(tutor, other, pacoca):
    from tests.test_people import invite

    other.post(f"/invites/{invite(tutor, pacoca['id'], 'guest')['token']}/accept")
    other.post(f"/animals/{pacoca['id']}/weights", {"date": "2026-11-05", "kg": "8.3"})
    card = other.get(f"/animals/{pacoca['id']}/card").json()
    editable = [
        (s["kind"], i["title"]) for s in card["sections"] for i in s["items"] if i["can_edit"]
    ]
    assert len(card["sections"]) == 5
    assert editable == [("weight", "8,3 kg")]


def test_the_pdf_has_the_same_sections_without_notes_or_photos(tutor, pacoca):
    text = pdf_text(tutor.get(f"/animals/{pacoca['id']}/card.pdf").content)
    for heading in ("Vacinas", "Antiparasitários", "Consultas e exames", "Peso"):
        assert heading in text
    assert "Observações" not in text
    assert not any("Coçando" in run for run in text)
    # An old dose has no "repeat on"; the vaccines have no "Contra" column.
    vaccines = text[text.index("Vacinas") : text.index("Antiparasitários")]
    assert vaccines[:4] == ["Vacinas", "Data", "Vacina", "Repetir em"]
    assert vaccines[-3:] == ["06/11/2024", "Vanguard Plus", "—"]
    assert "10/03/2027" in vaccines
    response = tutor.get(f"/animals/{pacoca['id']}/card.pdf")
    assert b"/Subtype /Image" not in response.content


def test_the_pdf_is_a_pdf_for_whoever_has_access(tutor, gata):
    response = tutor.get(f"/animals/{gata['id']}/card.pdf")
    assert response.status_code == 200
    assert response["Content-Type"] == "application/pdf"
    assert response.content.startswith(b"%PDF")
    assert "carteirinha-gata.pdf" in response["Content-Disposition"]


def test_nobody_without_access_gets_the_card_or_the_pdf(gata, other):
    assert other.get(f"/animals/{gata['id']}/card").status_code == 404
    assert other.get(f"/animals/{gata['id']}/card.pdf").status_code == 404


def test_no_route_reads_an_animal_without_a_session(gata):
    from conftest import Api

    anonymous = Api()
    assert anonymous.get(f"/animals/{gata['id']}/card.pdf").status_code == 401
    assert anonymous.get(f"/animals/{gata['id']}").status_code == 401


def test_the_pdf_says_canino_and_a_blank_breed_is_srd(tutor):
    thor = make_animal(tutor, {**DOG, "name": "Thor", "breed": ""})
    text = pdf_text(tutor.get(f"/animals/{thor['id']}/card.pdf").content)
    assert text[text.index("Espécie") + 1] == "Canino"
    assert text[text.index("Raça") + 1] == "SRD (sem raça definida)"
    # The stored breed stays blank: only what is shown changes.
    assert tutor.get(f"/animals/{thor['id']}").json()["breed"] == ""
