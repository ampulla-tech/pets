"""The benchmark's normalisation, matching and choice, with recorded answers."""

from intake.benchmark import (
    KeyRecord,
    ModelResult,
    RunScore,
    choose,
    load_key,
    match,
    norm_crmv,
    norm_date,
    norm_kg,
    norm_month,
    proposal_record,
    report,
    score_card,
)

KEY = {
    "schema": "pets-carteirinha-gabarito/v2",
    "carteirinhas": [
        {
            "animal": "cao",
            "fotos": ["A", "B"],
            "perfil_esperado": {"especie": "canina"},
            "registros": [
                {
                    "tipo": "vacina",
                    "data": "2026-10-16",
                    "produto": "Nobivac DHPPi+L",
                    "partida": "011/25",
                    "vencimento_lote": "FEV/27",
                    "doencas": [
                        "cinomose",
                        "hepatite infecciosa",
                        "parvovirose",
                        "parainfluenza",
                        "leptospirose",
                    ],
                    "repetir_em": "2026-11-06",
                    "repetir_em_origem": "inferido",
                    "crmv": "CRMV-SC 1",
                    "dose": "",
                    "peso_kg": None,
                },
                {
                    "tipo": "antiparasitario",
                    "data": "2026-10-13",
                    "produto": "Drontal",
                    "partida": "",
                    "vencimento_lote": "",
                    "doencas": ["verme interno"],
                    "repetir_em": "2026-10-21",
                    "repetir_em_origem": "escrito",
                    "crmv": "",
                    "dose": "1 mL",
                    "peso_kg": None,
                },
                {
                    "tipo": "peso",
                    "data": "2026-08-02",
                    "produto": "",
                    "partida": "",
                    "vencimento_lote": "",
                    "doencas": [],
                    "repetir_em": "",
                    "repetir_em_origem": None,
                    "crmv": "",
                    "dose": "",
                    "peso_kg": 4.9,
                },
            ],
        }
    ],
}


def read(value):
    return {"value": value, "read": value is not None}


def proposal(
    kind,
    day,
    diseases,
    repeat=None,
    origin=None,
    brand=None,
    lot=None,
    expiry=None,
    crmv=None,
    dose=None,
    kg=None,
):
    return {
        "kind": kind,
        "date": read(day),
        "brand": read(brand),
        "lot": read(lot),
        "lot_expiry": read(expiry),
        "diseases": {"value": diseases, "read": bool(diseases)},
        "repeat_on": {"value": repeat, "read": repeat is not None, "origin": origin},
        "vet_name": read(None),
        "vet_crmv": read(crmv),
        "dose": read(dose),
        "weight_kg": read(kg),
    }


PERFECT = [
    proposal(
        "vaccine",
        "2026-10-16",
        ["distemper", "infectious_hepatitis", "parvovirus", "parainfluenza", "leptospirosis"],
        "2026-11-06",
        "inferred",
        "Nobivac  DHPPi+L",
        "011/25",
        "2027-02",
        "crmv-sc1",
    ),
    proposal(
        "antiparasitic", "2026-10-13", ["internal"], "2026-10-21", "written", "drontal", dose="1 ml"
    ),
    proposal("weight", "2026-08-02", [], kg=4.9),
]


def test_normalisation():
    assert norm_month("MAI/26") == "2026-05"
    assert norm_month("05/2026") == "2026-05"
    assert norm_month("2026-05-31") == "2026-05"
    assert norm_date("06/11/26") == "2026-11-06"
    assert norm_date("2026-02-30") is None
    assert norm_kg("4,285") == norm_kg(4.285) == "4.285"
    assert norm_crmv("CRMV-SC 12.345") == norm_crmv("crmvsc12345") == "CRMVSC12345"


def test_the_key_loads_with_codes_and_normalised_values():
    [card] = load_key(KEY)
    assert card.species == "dog" and card.photos == ["A", "B"]
    vaccine = card.records[0]
    assert vaccine.lot_expiry == "2027-02"
    assert vaccine.repeat_origin == "inferred"
    assert "infectious_hepatitis" in vaccine.diseases
    assert card.records[1].diseases == frozenset({"internal"})


def score(proposals):
    [card] = load_key(KEY)
    result = RunScore(cards=1, cost=0.004)
    score_card(result, card.records, proposals)
    return result


def test_a_perfect_reading_scores_one_everywhere():
    result = score(PERFECT)
    assert result.records_exact
    for name in (
        "date",
        "repeat_on",
        "diseases",
        "brand",
        "lot",
        "lot_expiry",
        "crmv",
        "dose",
        "weight",
    ):
        assert result.accuracy(name) == 1.0, name


def test_a_wrong_origin_fails_repeat_on():
    wrong = [
        dict(PERFECT[0], repeat_on={"value": "2026-11-06", "read": True, "origin": "written"}),
        *PERFECT[1:],
    ]
    assert score(wrong).accuracy("repeat_on") == 0.5


def test_two_labels_read_as_two_records_is_an_extra_record():
    result = score([PERFECT[0], PERFECT[0], *PERFECT[1:]])
    assert (result.matched, result.extra) == (3, 1)
    assert not result.records_exact


def test_a_missing_record_counts_against_every_field_of_it():
    result = score(PERFECT[:2])
    assert result.matched == 2 and result.accuracy("weight") == 0.0


def test_a_date_misread_still_matches_by_diseases():
    misread = [dict(PERFECT[0], date=read("2026-10-19")), *PERFECT[1:]]
    result = score(misread)
    assert result.matched == 3
    assert result.accuracy("date") == 2 / 3


def test_the_cheapest_passing_model_is_chosen():
    perfect, flawed = score(PERFECT), score(PERFECT[:2])
    cheap_flawed = ModelResult("cheap", [flawed])
    pricey = ModelResult("pricey", [perfect])
    cheaper = ModelResult("cheaper", [score(PERFECT)])
    cheaper.runs[0].cost = 0.001
    assert choose([cheap_flawed, pricey, cheaper]).model == "cheaper"
    assert choose([cheap_flawed]) is None


def test_the_worst_run_counts():
    result = ModelResult("m", [score(PERFECT), score(PERFECT[:2])])
    assert not result.passes
    assert result.worst("weight") == 0.0


def test_the_report_holds_only_aggregates():
    text = report([ModelResult("vendor/model", [score(PERFECT)])], 1, "2026-10-31")
    assert "`vendor/model`" in text and "3/3" in text and "$0.0040" in text
    assert "Chosen: `vendor/model`" in text
    assert "Nobivac" not in text and "CRMV" not in text and "011/25" not in text


def test_matching_is_greedy_on_date_and_diseases():
    a = KeyRecord(
        "vaccine",
        "2026-01-01",
        None,
        None,
        None,
        frozenset({"rabies"}),
        None,
        None,
        None,
        None,
        None,
    )
    b = KeyRecord(
        "vaccine",
        "2026-02-01",
        None,
        None,
        None,
        frozenset({"rabies"}),
        None,
        None,
        None,
        None,
        None,
    )
    assert sorted(match([a, b], [b, a])) == [(0, 1), (1, 0)]
    assert proposal_record(PERFECT[2]).weight_kg == "4.900"
