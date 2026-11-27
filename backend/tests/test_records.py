"""Vaccines, antiparasitics, weights, notes and visits, by hand."""

from animals.models import Attachment, Weight
from conftest import CAT, DOG, jpeg_file, make_animal, pdf_file

RABMUNE = {
    "date": "2026-10-05",
    "brand": "Rabmune",
    "lot": "014/25",
    "lot_expiry": "2027-06",
    "diseases": ["rabies"],
    "repeat_on": "2027-10-05",
    "repeat_on_origin": "written",
    "vet_name": "Dra. Exemplo",
    "vet_crmv": "CRMV-SC 00000",
}


def test_a_vaccine_is_registered_with_its_author(tutor):
    cat = make_animal(tutor, CAT)
    response = tutor.post(f"/animals/{cat['id']}/vaccines", RABMUNE)
    assert response.status_code == 201
    body = response.json()
    assert body["kind"] == "vaccine"
    assert body["diseases"] == ["rabies"]
    assert body["repeat_on"] == "2027-10-05"
    assert body["created_by"]["email"] == "tutor@example.com"
    assert body["updated_by"]["email"] == "tutor@example.com"


def test_a_disease_of_another_species_is_refused(tutor):
    cat = make_animal(tutor, CAT)
    response = tutor.post(f"/animals/{cat['id']}/vaccines", {**RABMUNE, "diseases": ["distemper"]})
    assert response.status_code == 422


def test_a_vaccine_needs_at_least_one_disease(tutor):
    cat = make_animal(tutor, CAT)
    response = tutor.post(f"/animals/{cat['id']}/vaccines", {**RABMUNE, "diseases": []})
    assert response.status_code == 422


def test_a_lot_expiry_that_is_not_a_month_is_refused(tutor):
    cat = make_animal(tutor, CAT)
    for value in ("09/2027", "092027", "2027-9", "2027-00", "2027-13", "set 27", " 2027-09"):
        response = tutor.post(f"/animals/{cat['id']}/vaccines", {**RABMUNE, "lot_expiry": value})
        assert response.status_code == 422, value
        assert "lot_expiry" in str(response.json()), value


def test_a_lot_expiry_is_a_month_or_empty(tutor):
    cat = make_animal(tutor, CAT)
    for value in ("2027-09", "2027-12", ""):
        response = tutor.post(f"/animals/{cat['id']}/vaccines", {**RABMUNE, "lot_expiry": value})
        assert response.status_code == 201, value
        assert response.json()["lot_expiry"] == value


def test_an_edit_cannot_store_a_lot_expiry_that_is_not_a_month(tutor):
    cat = make_animal(tutor, CAT)
    created = tutor.post(f"/animals/{cat['id']}/vaccines", RABMUNE).json()
    path = f"/animals/{cat['id']}/vaccines/{created['id']}"
    assert tutor.put(path, {**RABMUNE, "lot_expiry": "06/2027"}).status_code == 422
    records = tutor.get(f"/animals/{cat['id']}/records").json()
    assert [r["lot_expiry"] for r in records] == ["2027-06"]


def test_a_combined_vaccine_keeps_every_disease(tutor):
    dog = make_animal(tutor, DOG)
    diseases = ["distemper", "infectious_hepatitis", "parvovirus", "parainfluenza", "leptospirosis"]
    body = {"date": "2026-10-16", "brand": "Nobivac DHPPi+L", "diseases": diseases}
    response = tutor.post(f"/animals/{dog['id']}/vaccines", body)
    assert response.json()["diseases"] == diseases


def test_the_history_lists_every_kind_newest_first(tutor):
    dog = make_animal(tutor, DOG)
    base = f"/animals/{dog['id']}"
    tutor.post(f"{base}/vaccines", {"date": "2026-10-16", "diseases": ["rabies"]})
    tutor.post(f"{base}/weights", {"date": "2026-10-20", "kg": "3.1"})
    tutor.post(f"{base}/notes", {"date": "2026-10-18", "text": "Comeu bem."})
    kinds = [(r["kind"], r["date"]) for r in tutor.get(f"{base}/records").json()]
    assert kinds == [("weight", "2026-10-20"), ("note", "2026-10-18"), ("vaccine", "2026-10-16")]


def test_a_vaccine_is_edited_and_deleted(tutor):
    cat = make_animal(tutor, CAT)
    created = tutor.post(f"/animals/{cat['id']}/vaccines", RABMUNE).json()
    path = f"/animals/{cat['id']}/vaccines/{created['id']}"
    edited = tutor.put(path, {**RABMUNE, "lot": "015/25"}).json()
    assert edited["lot"] == "015/25"
    assert tutor.delete(path).status_code == 204
    assert tutor.get(f"/animals/{cat['id']}/records").json() == []


def test_a_photo_attached_to_a_vaccine_lives_in_the_storage(tutor):
    cat = make_animal(tutor, CAT)
    uploaded = tutor.upload(f"/animals/{cat['id']}/attachments", [jpeg_file()]).json()
    created = tutor.post(
        f"/animals/{cat['id']}/vaccines",
        {**RABMUNE, "attachment_ids": [uploaded[0]["id"]]},
    ).json()
    assert [a["id"] for a in created["attachments"]] == [uploaded[0]["id"]]
    attachment = Attachment.objects.get(id=uploaded[0]["id"])
    assert attachment.file.storage.exists(attachment.file.name)


def test_another_animals_attachment_cannot_be_used(tutor):
    cat = make_animal(tutor, CAT)
    dog = make_animal(tutor, DOG)
    uploaded = tutor.upload(f"/animals/{dog['id']}/attachments", [jpeg_file()]).json()
    response = tutor.post(
        f"/animals/{cat['id']}/vaccines", {**RABMUNE, "attachment_ids": [uploaded[0]["id"]]}
    )
    assert response.status_code == 422


DRONTAL = {
    "date": "2026-10-13",
    "parasite": "internal",
    "product": "Drontal",
    "dose": "1 mL",
    "repeat_on": "2026-10-21",
}


def test_an_antiparasitic_with_a_weight_makes_two_records(tutor):
    cat = make_animal(tutor, CAT)
    response = tutor.post(f"/animals/{cat['id']}/antiparasitics", {**DRONTAL, "weight_kg": 4.3})
    assert response.status_code == 201
    kinds = sorted(
        (r["kind"], r["date"]) for r in tutor.get(f"/animals/{cat['id']}/records").json()
    )
    assert kinds == [("antiparasitic", "2026-10-13"), ("weight", "2026-10-13")]
    assert response.json()["weight_kg"] == "4.300"


def test_deleting_the_antiparasitic_keeps_the_weight(tutor):
    cat = make_animal(tutor, CAT)
    created = tutor.post(f"/animals/{cat['id']}/antiparasitics", {**DRONTAL, "weight_kg": 4.3})
    tutor.delete(f"/animals/{cat['id']}/antiparasitics/{created.json()['id']}")
    assert Weight.objects.filter(animal_id=cat["id"]).count() == 1


def test_the_profile_shows_the_last_weight(tutor):
    cat = make_animal(tutor, CAT)
    tutor.post(f"/animals/{cat['id']}/weights", {"date": "2025-07-03", "kg": "4.285"})
    tutor.post(f"/animals/{cat['id']}/weights", {"date": "2026-08-02", "kg": "4.9"})
    profile = tutor.get(f"/animals/{cat['id']}").json()
    assert profile["last_weight"] == {"kg": "4.900", "date": "2026-08-02"}


def test_a_visit_keeps_its_photo_and_pdf(tutor):
    dog = make_animal(tutor, DOG)
    uploaded = tutor.upload(f"/animals/{dog['id']}/attachments", [jpeg_file(), pdf_file()])
    assert uploaded.status_code == 201
    ids = [a["id"] for a in uploaded.json()]
    visit = tutor.post(
        f"/animals/{dog['id']}/visits",
        {"date": "2026-10-20", "clinic": "Clínica", "reason": "Rotina", "attachment_ids": ids},
    ).json()
    types = sorted(a["content_type"] for a in visit["attachments"])
    assert types == ["application/pdf", "image/jpeg"]
    pdf = next(a for a in visit["attachments"] if a["content_type"] == "application/pdf")
    served = tutor.client.get(pdf["url"].replace("http://testserver", ""))
    assert served.status_code == 200 and served["Content-Type"] == "application/pdf"


def test_deleting_a_visit_deletes_the_files_only_it_used(tutor):
    dog = make_animal(tutor, DOG)
    ids = [
        a["id"]
        for a in tutor.upload(f"/animals/{dog['id']}/attachments", [jpeg_file(), pdf_file()]).json()
    ]
    visit = tutor.post(
        f"/animals/{dog['id']}/visits", {"date": "2026-10-20", "attachment_ids": ids}
    ).json()
    tutor.post(
        f"/animals/{dog['id']}/notes",
        {"date": "2026-10-20", "text": "x", "attachment_ids": ids[:1]},
    )
    tutor.delete(f"/animals/{dog['id']}/visits/{visit['id']}")
    assert list(Attachment.objects.values_list("id", flat=True)) == [
        __import__("uuid").UUID(ids[0])
    ]


def test_a_text_file_is_refused(tutor):
    from django.core.files.uploadedfile import SimpleUploadedFile

    dog = make_animal(tutor, DOG)
    text = SimpleUploadedFile("a.txt", b"hello", content_type="text/plain")
    assert tutor.upload(f"/animals/{dog['id']}/attachments", [text]).status_code == 415


def test_a_heic_photo_is_converted_to_jpeg(tutor):
    import io

    from django.core.files.uploadedfile import SimpleUploadedFile
    from PIL import Image
    from pillow_heif import register_heif_opener

    register_heif_opener()
    out = io.BytesIO()
    Image.new("RGB", (40, 30), (10, 200, 10)).save(out, format="HEIF")
    heic = SimpleUploadedFile("IMG_0001.HEIC", out.getvalue(), content_type="image/heic")
    dog = make_animal(tutor, DOG)
    stored = tutor.upload(f"/animals/{dog['id']}/attachments", [heic]).json()
    assert stored[0]["content_type"] == "image/jpeg"
