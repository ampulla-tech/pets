"""The card for the clinic's counter, and its PDF: only for whoever has access."""

from datetime import date

import pytest

from conftest import CAT, DOG, jpeg_file, make_animal, pdf_text

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
        assert tutor.post(f"/animals/{cat['id']}/vaccines", body).status_code == 201
    return cat


def test_the_card_has_one_row_per_disease_with_the_last_and_next_dose(tutor, gata):
    card = tutor.get(f"/animals/{gata['id']}/card").json()
    rows = {row["subject"]: row for row in card["rows"]}
    assert list(rows) == [*FELINE, "felv", "rabies"]
    assert (
        rows["rabies"]["last_product"],
        rows["rabies"]["last_date"],
        rows["rabies"]["next_on"],
        rows["rabies"]["last_vet"],
    ) == ("Rabmune", "2026-10-05", "2027-10-05", "Dra. Exemplo")
    assert rows["felv"]["last_product"] == "Felocell FeLV"
    assert len(rows["calicivirus"]["photos"]) == 1
    assert rows["rabies"]["photos"] == []
    assert card["animal"]["name"] == "GATA"


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
