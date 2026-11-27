"""Photo intake: the model proposes, only the tutor's confirmation writes."""

from datetime import date

import pytest
from langchain_core.messages import AIMessage

from animals.models import Vaccine, Weight
from conftest import CAT, DOG, jpeg_file, make_animal
from intake.models import Extraction
from intake.process import claim_next, process
from intake.reading import CardReading, ReadResult, read_card


def field(value, read=True):
    return {"value": value if read else None, "read": read}


def vaccine_proposal(day, brand, diseases, repeat, origin="written", crmv_read=False):
    return {
        "kind": "vaccine",
        "date": field(day),
        "brand": field(brand),
        "lot": field("011/25"),
        "lot_expiry": field("2027-09"),
        "diseases": {"value": diseases, "read": True},
        "repeat_on": {"value": repeat, "read": True, "origin": origin},
        "vet_name": field(None, read=False),
        "vet_crmv": field("CRMV-SC 1", read=crmv_read),
        "dose": field(None, read=False),
        "weight_kg": field(None, read=False),
    }


FIVE = [
    vaccine_proposal(
        "2026-05-18",
        "Felocell CVR-C",
        ["rhinotracheitis", "calicivirus", "panleukopenia", "chlamydiosis"],
        "2026-06-08",
    ),
    vaccine_proposal(
        "2026-06-06",
        "Felocell CVR-C",
        ["rhinotracheitis", "calicivirus", "panleukopenia", "chlamydiosis"],
        "2027-06-06",
    ),
    vaccine_proposal("2026-06-06", "Bioraiva Pet", ["rabies"], "2027-06-06"),
    vaccine_proposal("2026-10-05", "Felocell FeLV", ["felv"], "2026-10-26"),
    vaccine_proposal("2026-10-27", "Felocell FeLV", ["felv"], "2027-10-27"),
]


def fake_reader(proposals):
    return lambda photos, species: ReadResult(proposals=proposals, model="fake/model", cost=0.01)


@pytest.fixture
def cat(tutor):
    return make_animal(tutor, CAT)


def send_photos(api, animal, count=2):
    response = api.upload(
        f"/animals/{animal['id']}/extractions", [jpeg_file(f"p{i}.jpg") for i in range(count)]
    )
    assert response.status_code == 202, response.content
    return response.json()


def test_sending_photos_answers_at_once_with_the_reading_in_progress(tutor, cat):
    sent = send_photos(tutor, cat)
    assert sent["status"] == "processing"
    assert len(sent["photos"]) == 2
    assert sent["proposals"] == []


def test_the_reading_runs_in_the_worker_and_the_client_follows_it(tutor, cat):
    sent = send_photos(tutor, cat)
    extraction = claim_next()
    assert str(extraction.id) == sent["id"]
    assert claim_next() is None
    process(extraction, reader=fake_reader(FIVE))
    ready = tutor.get(f"/extractions/{sent['id']}").json()
    assert ready["status"] == "ready"
    assert len(ready["proposals"]) == 5
    line = ready["proposals"][2]
    assert line["brand"] == {"value": "Bioraiva Pet", "read": True}
    assert line["vet_name"] == {"value": None, "read": False}
    assert line["review"] == "pending"
    assert Vaccine.objects.count() == 0


def confirm_body(proposal, **changes):
    body = {
        "kind": "vaccine",
        "date": proposal["date"]["value"],
        "brand": proposal["brand"]["value"] or "",
        "lot": proposal["lot"]["value"] or "",
        "lot_expiry": proposal["lot_expiry"]["value"] or "",
        "diseases": proposal["diseases"]["value"],
        "repeat_on": proposal["repeat_on"]["value"],
        "repeat_on_origin": proposal["repeat_on"]["origin"] or "",
    }
    return {"record": {**body, **changes}}


def test_confirming_four_of_five_writes_four_records_with_the_same_photos(tutor, cat):
    sent = send_photos(tutor, cat)
    process(Extraction.objects.get(id=sent["id"]), reader=fake_reader(FIVE))
    proposals = tutor.get(f"/extractions/{sent['id']}").json()["proposals"]
    base = f"/extractions/{sent['id']}/proposals"
    for proposal in proposals[:4]:
        changes = {"lot": "012/25"} if proposal["index"] == 0 else {}
        response = tutor.post(
            f"{base}/{proposal['index']}/confirm", confirm_body(proposal, **changes)
        )
        assert response.status_code == 201, response.content
    assert tutor.post(f"{base}/4/discard").status_code == 200

    vaccines = Vaccine.objects.order_by("date", "created_at")
    assert vaccines.count() == 4
    assert vaccines[0].lot == "012/25"
    photo_sets = {frozenset(v.attachments.values_list("id", flat=True)) for v in vaccines}
    assert photo_sets == {frozenset(__import__("uuid").UUID(p["id"]) for p in sent["photos"])}
    reviewed = [p["review"] for p in tutor.get(f"/extractions/{sent['id']}").json()["proposals"]]
    assert reviewed == ["confirmed"] * 4 + ["discarded"]


def test_a_line_is_reviewed_only_once(tutor, cat):
    sent = send_photos(tutor, cat)
    process(Extraction.objects.get(id=sent["id"]), reader=fake_reader(FIVE))
    proposal = tutor.get(f"/extractions/{sent['id']}").json()["proposals"][0]
    path = f"/extractions/{sent['id']}/proposals/0"
    tutor.post(f"{path}/confirm", confirm_body(proposal))
    assert tutor.post(f"{path}/confirm", confirm_body(proposal)).status_code == 409
    assert tutor.post(f"{path}/discard").status_code == 409
    assert Vaccine.objects.count() == 1


def test_discarding_writes_nothing(tutor, cat):
    sent = send_photos(tutor, cat)
    process(Extraction.objects.get(id=sent["id"]), reader=fake_reader(FIVE))
    for index in range(5):
        tutor.post(f"/extractions/{sent['id']}/proposals/{index}/discard")
    assert Vaccine.objects.count() == 0


def test_a_failed_reading_writes_nothing_and_can_be_retried(tutor, cat):
    sent = send_photos(tutor, cat)

    def broken(photos, species):
        raise RuntimeError("provider down")

    process(Extraction.objects.get(id=sent["id"]), reader=broken)
    failed = tutor.get(f"/extractions/{sent['id']}").json()
    assert (failed["status"], failed["error"]) == ("failed", "provider")
    assert tutor.post(f"/extractions/{sent['id']}/proposals/0/discard").status_code == 409
    assert Vaccine.objects.count() == 0
    retried = tutor.post(f"/extractions/{sent['id']}/retry")
    assert retried.json()["status"] == "processing"
    assert claim_next() is not None


def test_reading_nothing_is_a_failure(tutor, cat):
    sent = send_photos(tutor, cat)
    process(Extraction.objects.get(id=sent["id"]), reader=fake_reader([]))
    assert tutor.get(f"/extractions/{sent['id']}").json()["error"] == "nothing_read"


def test_without_a_model_the_reading_says_it_is_unconfigured(tutor, cat, settings):
    settings.INTAKE_MODEL = ""
    sent = send_photos(tutor, cat)
    process(Extraction.objects.get(id=sent["id"]))
    assert tutor.get(f"/extractions/{sent['id']}").json()["error"] == "unconfigured"


def test_the_failure_path_fills_by_hand_with_the_photo_attached(tutor, cat):
    sent = send_photos(tutor, cat, count=1)
    photo = sent["photos"][0]["id"]
    created = tutor.post(
        f"/animals/{cat['id']}/vaccines",
        {
            "date": "2026-06-06",
            "diseases": ["rabies"],
            "attachment_ids": [photo],
        },
    ).json()
    assert [a["id"] for a in created["attachments"]] == [photo]


def test_a_proposed_weight_becomes_a_weight(tutor, cat):
    weight = {
        "kind": "weight",
        "date": field("2026-08-02"),
        "brand": field(None, False),
        "lot": field(None, False),
        "lot_expiry": field(None, False),
        "diseases": {"value": [], "read": False},
        "repeat_on": {"value": None, "read": False, "origin": None},
        "vet_name": field(None, False),
        "vet_crmv": field(None, False),
        "dose": field(None, False),
        "weight_kg": field(4.9),
    }
    sent = send_photos(tutor, cat, count=1)
    process(Extraction.objects.get(id=sent["id"]), reader=fake_reader([weight]))
    response = tutor.post(
        f"/extractions/{sent['id']}/proposals/0/confirm",
        {"record": {"kind": "weight", "date": "2026-08-02", "kg": "4.9"}},
    )
    assert response.status_code == 201
    assert Weight.objects.get().attachments.count() == 1


def test_confirming_recomputes_the_reminders(tutor, cat, today):
    today(date(2026, 10, 31))
    sent = send_photos(tutor, cat)
    process(Extraction.objects.get(id=sent["id"]), reader=fake_reader(FIVE))
    proposals = tutor.get(f"/extractions/{sent['id']}").json()["proposals"]
    tutor.post(f"/extractions/{sent['id']}/proposals/3/confirm", confirm_body(proposals[3]))
    felv = [
        r for r in tutor.get(f"/animals/{cat['id']}/reminders").json() if r["subject"] == "felv"
    ]
    assert [(r["state"], r["due_on"]) for r in felv] == [("overdue", "2026-10-26")]


def test_a_guest_and_a_stranger_do_not_see_a_reading(tutor, cat, other):
    sent = send_photos(tutor, cat)
    assert other.get(f"/extractions/{sent['id']}").status_code == 404


# ── The graph ───────────────────────────────────────────────────────────────


class FakeStructured:
    def __init__(self, reading, calls):
        self.reading, self.calls = reading, calls

    def invoke(self, messages):
        self.calls.append(messages)
        return {
            "parsed": CardReading.model_validate(self.reading),
            "raw": AIMessage(content="", response_metadata={"cost": 0.0042}),
            "parsing_error": None,
        }


class FakeModel:
    def __init__(self, reading):
        self.reading, self.calls, self.kwargs = reading, [], None

    def with_structured_output(self, schema, **kwargs):
        self.kwargs = kwargs
        return FakeStructured(self.reading, self.calls)


def test_the_graph_sends_the_photos_as_image_blocks_and_cleans_the_answer():
    raw = vaccine_proposal(
        "2026-10-16",
        "Nobivac DHPPi+L",
        ["distemper", "parvovirus", "rabies", "felv"],
        "2026-11-06",
        origin="inferred",
    )
    raw["lot"] = {"value": "guessed", "read": False}
    raw["date"] = {"value": "16/10/26", "read": True}
    model = FakeModel({"proposals": [raw]})
    result = read_card([], "dog", "fake/model", "key", llm=model)
    assert model.kwargs == {"method": "json_schema", "include_raw": True}
    [proposal] = result.proposals
    assert proposal["diseases"]["value"] == ["distemper", "parvovirus", "rabies"]
    assert proposal["lot"] == {"value": None, "read": False}
    assert proposal["date"] == {"value": None, "read": False}
    assert proposal["repeat_on"] == {"value": "2026-11-06", "read": True, "origin": "inferred"}
    assert result.cost == 0.0042


def test_the_graph_puts_each_photo_in_the_message():
    from intake.reading import Photo

    model = FakeModel({"proposals": []})
    read_card([Photo(b"a"), Photo(b"b")], "cat", "fake/model", "key", llm=model)
    system, human = model.calls[0]
    assert "felv: FeLV" in system.content
    assert "- distemper:" not in system.content
    images = [block for block in human.content if block["type"] == "image"]
    assert [b["base64"] for b in images] == ["YQ==", "Yg=="]


def test_a_dog_reading_keeps_only_dog_diseases():
    from intake.reading import clean

    proposal = clean(vaccine_proposal("2026-10-16", "x", ["felv", "rabies"], None), "dog")
    assert proposal["diseases"]["value"] == ["rabies"]


@pytest.mark.parametrize(
    "read, expected",
    [
        ("2026-05", {"value": "2026-05", "read": True}),
        (" 2026-05 ", {"value": "2026-05", "read": True}),
        ("MAI/26", {"value": None, "read": False}),
        ("05/2026", {"value": None, "read": False}),
        ("2026-13", {"value": None, "read": False}),
        ("2026-5", {"value": None, "read": False}),
        ("maio de 2026", {"value": None, "read": False}),
    ],
)
def test_a_lot_expiry_that_is_not_a_month_is_read_as_unread(read, expected):
    from intake.reading import clean

    raw = vaccine_proposal("2026-10-16", "x", ["rabies"], None)
    raw["lot_expiry"] = field(read)
    raw["lot"] = field("014/25")
    proposal = clean(raw, "cat")
    assert proposal["lot_expiry"] == expected
    assert proposal["lot"] == {"value": "014/25", "read": True}


def test_only_a_tutor_sends_photos_of_an_active_animal(tutor, other):
    dog = make_animal(tutor, DOG)
    response = other.upload(f"/animals/{dog['id']}/extractions", [jpeg_file()])
    assert response.status_code == 404
