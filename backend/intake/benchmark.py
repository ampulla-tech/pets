"""The benchmark that chooses the reading model (ADR-0005).

The evaluation set is the tutor's own cards: photos and an answer key (the
"gabarito", schema `pets-carteirinha-gabarito/v2`). Both hold third-party
personal data (vets' names and CRMVs, a microchip), so neither lives in the
repository: the command reads them from paths it is given, and the report it
writes holds only aggregate scores per model and field.

Each proposed record is matched to the key by kind, date and diseases (a pair
with neither the same date nor the same diseases is not a match). A key record
left unmatched, or a proposal left over, is a records error. Fields are then
compared after normalisation. A model is scored by the worst of its runs, and
the chosen one is the cheapest with 1.00 on date, "repeat on" (value and
origin) and diseases, and no record missing or extra, on every run.
"""

import re
import statistics
import unicodedata
from dataclasses import dataclass, field
from datetime import date
from decimal import Decimal, InvalidOperation

# ── The answer key ──────────────────────────────────────────────────────────

SPECIES = {"canina": "dog", "felina": "cat"}
KINDS = {"vacina": "vaccine", "antiparasitario": "antiparasitic", "peso": "weight"}
ORIGINS = {"escrito": "written", "inferido": "inferred"}

DISEASE_CODES = {
    "cinomose": "distemper",
    "hepatite infecciosa": "infectious_hepatitis",
    "parvovirose": "parvovirus",
    "parainfluenza": "parainfluenza",
    "leptospirose": "leptospirosis",
    "coronavirose": "coronavirus",
    "raiva": "rabies",
    "tosse dos canis": "kennel_cough",
    "gripe canina": "canine_influenza",
    "giardia": "giardia",
    "leishmaniose": "leishmaniasis",
    "rinotraqueite": "rhinotracheitis",
    "calicivirose": "calicivirus",
    "panleucopenia": "panleukopenia",
    "clamidiose": "chlamydiosis",
    "felv": "felv",
    "verme interno": "internal",
    "pulga e carrapato": "external",
}

MONTHS = {
    "JAN": 1,
    "FEV": 2,
    "MAR": 3,
    "ABR": 4,
    "MAI": 5,
    "JUN": 6,
    "JUL": 7,
    "AGO": 8,
    "SET": 9,
    "OUT": 10,
    "NOV": 11,
    "DEZ": 12,
}


def _fold(text: str) -> str:
    text = unicodedata.normalize("NFKD", text)
    return "".join(c for c in text if not unicodedata.combining(c)).lower().strip()


def disease_code(name: str) -> str:
    return DISEASE_CODES[_fold(name)]


@dataclass
class KeyRecord:
    kind: str
    date: str | None
    brand: str | None
    lot: str | None
    lot_expiry: str | None
    diseases: frozenset[str]
    repeat_on: str | None
    repeat_origin: str | None
    vet_crmv: str | None
    dose: str | None
    weight_kg: str | None


@dataclass
class Card:
    name: str
    species: str
    photos: list[str]
    records: list[KeyRecord]


def load_key(document: dict) -> list[Card]:
    if document.get("schema") != "pets-carteirinha-gabarito/v2":
        raise ValueError("not a pets-carteirinha-gabarito/v2 document")
    cards = []
    for card in document["carteirinhas"]:
        records = []
        for raw in card["registros"]:
            kind = KINDS[raw["tipo"]]
            records.append(
                KeyRecord(
                    kind=kind,
                    date=norm_date(raw.get("data")),
                    brand=norm_text(raw.get("produto")),
                    lot=norm_text(raw.get("partida")),
                    lot_expiry=norm_month(raw.get("vencimento_lote")),
                    diseases=frozenset(disease_code(d) for d in raw.get("doencas") or []),
                    repeat_on=norm_date(raw.get("repetir_em")),
                    repeat_origin=ORIGINS.get(raw.get("repetir_em_origem") or ""),
                    vet_crmv=norm_crmv(raw.get("crmv")),
                    dose=norm_text(raw.get("dose")),
                    weight_kg=norm_kg(raw.get("peso_kg")),
                )
            )
        cards.append(
            Card(
                name=card["animal"],
                species=SPECIES[card["perfil_esperado"]["especie"]],
                photos=list(card["fotos"]),
                records=records,
            )
        )
    return cards


# ── Normalisation ───────────────────────────────────────────────────────────


def norm_text(value) -> str | None:
    if value is None:
        return None
    text = re.sub(r"\s+", " ", str(value)).strip().casefold()
    return text or None


def norm_date(value) -> str | None:
    if not value:
        return None
    text = str(value).strip()
    match = re.match(r"^(\d{1,2})/(\d{1,2})/(\d{2,4})$", text)
    if match:
        day, month, year = (int(g) for g in match.groups())
        year = year + 2000 if year < 100 else year
        text = f"{year:04d}-{month:02d}-{day:02d}"
    try:
        return date.fromisoformat(text).isoformat()
    except ValueError:
        return None


def norm_month(value) -> str | None:
    """`MAI/26`, `05/2026`, `2026-05` and `2026-05-31` are all `2026-05`."""
    if not value:
        return None
    text = str(value).strip().upper()
    match = re.match(r"^([A-Z]{3})/(\d{2,4})$", text)
    if match and match.group(1) in MONTHS:
        year = int(match.group(2))
        return f"{year + 2000 if year < 100 else year:04d}-{MONTHS[match.group(1)]:02d}"
    match = re.match(r"^(\d{1,2})/(\d{2,4})$", text)
    if match:
        month, year = int(match.group(1)), int(match.group(2))
        return f"{year + 2000 if year < 100 else year:04d}-{month:02d}"
    match = re.match(r"^(\d{4})-(\d{2})(-\d{2})?$", text)
    if match:
        return f"{match.group(1)}-{match.group(2)}"
    return norm_text(value)


def norm_crmv(value) -> str | None:
    if not value:
        return None
    return re.sub(r"[\s.\-/]", "", str(value)).upper() or None


def norm_kg(value) -> str | None:
    if value in (None, ""):
        return None
    try:
        return str(Decimal(str(value).replace(",", ".")).quantize(Decimal("0.001")))
    except InvalidOperation:
        return None


def proposal_record(proposal: dict) -> KeyRecord:
    """A proposal from the reading, in the key's normalised shape."""

    def value(name):
        entry = proposal.get(name) or {}
        return entry.get("value") if entry.get("read") else None

    repeat = proposal.get("repeat_on") or {}
    return KeyRecord(
        kind=proposal.get("kind"),
        date=norm_date(value("date")),
        brand=norm_text(value("brand")),
        lot=norm_text(value("lot")),
        lot_expiry=norm_month(value("lot_expiry")),
        diseases=frozenset(value("diseases") or []),
        repeat_on=norm_date(value("repeat_on")),
        repeat_origin=repeat.get("origin") if repeat.get("read") else None,
        vet_crmv=norm_crmv(value("vet_crmv")),
        dose=norm_text(value("dose")),
        weight_kg=norm_kg(value("weight_kg")),
    )


# ── Matching and scoring ────────────────────────────────────────────────────

# The fields each kind is scored on.
FIELDS = {
    "vaccine": ["date", "repeat_on", "diseases", "brand", "lot", "lot_expiry", "crmv"],
    "antiparasitic": ["date", "repeat_on", "diseases", "brand", "dose"],
    "weight": ["date", "weight"],
}
REPORT_FIELDS = [
    "date",
    "repeat_on",
    "diseases",
    "brand",
    "lot",
    "lot_expiry",
    "crmv",
    "dose",
    "weight",
]
DECISIVE = ["date", "repeat_on", "diseases"]


def field_equal(name: str, key: KeyRecord, got: KeyRecord) -> bool:
    if name == "repeat_on":
        return key.repeat_on == got.repeat_on and (
            key.repeat_on is None or key.repeat_origin == got.repeat_origin
        )
    if name == "crmv":
        return key.vet_crmv == got.vet_crmv
    if name == "weight":
        return key.weight_kg == got.weight_kg
    return getattr(key, name) == getattr(got, name)


def match(key: list[KeyRecord], proposed: list[KeyRecord]) -> list[tuple[int, int]]:
    """Pair key records with proposals: same kind, and the same date or diseases.

    Greedy on a score that weighs date and diseases first, so the pairing is
    the one a person comparing by eye would make.
    """
    candidates = []
    for i, expected in enumerate(key):
        for j, got in enumerate(proposed):
            if expected.kind != got.kind:
                continue
            same_date = expected.date is not None and expected.date == got.date
            same_diseases = bool(expected.diseases) and expected.diseases == got.diseases
            if expected.kind == "weight":
                same_diseases = expected.weight_kg == got.weight_kg
            if not (same_date or same_diseases):
                continue
            score = 4 * same_date + 4 * same_diseases
            score += (expected.brand == got.brand) + (expected.lot == got.lot)
            score += expected.repeat_on == got.repeat_on
            candidates.append((score, i, j))
    pairs, used_key, used_got = [], set(), set()
    for _score, i, j in sorted(candidates, reverse=True):
        if i in used_key or j in used_got:
            continue
        pairs.append((i, j))
        used_key.add(i)
        used_got.add(j)
    return pairs


@dataclass
class RunScore:
    expected: int = 0
    matched: int = 0
    extra: int = 0
    correct: dict[str, int] = field(default_factory=dict)
    total: dict[str, int] = field(default_factory=dict)
    cost: float = 0.0
    cost_known: bool = True
    seconds: list[float] = field(default_factory=list)
    cards: int = 0

    @property
    def records_exact(self) -> bool:
        return self.matched == self.expected and self.extra == 0

    def accuracy(self, name: str) -> float | None:
        total = self.total.get(name, 0)
        return None if total == 0 else self.correct.get(name, 0) / total


def score_card(score: RunScore, key: list[KeyRecord], proposals: list[dict]) -> None:
    proposed = [proposal_record(p) for p in proposals]
    pairs = dict(match(key, proposed))
    score.expected += len(key)
    score.matched += len(pairs)
    score.extra += len(proposed) - len(pairs)
    for i, expected in enumerate(key):
        got = proposed[pairs[i]] if i in pairs else None
        for name in FIELDS[expected.kind]:
            score.total[name] = score.total.get(name, 0) + 1
            if got is not None and field_equal(name, expected, got):
                score.correct[name] = score.correct.get(name, 0) + 1


@dataclass
class ModelResult:
    model: str
    runs: list[RunScore]
    errors: int = 0

    def worst(self, name: str) -> float | None:
        values = [r.accuracy(name) for r in self.runs]
        values = [v for v in values if v is not None]
        return min(values) if values else None

    @property
    def worst_records(self) -> tuple[int, int, int]:
        """(matched, expected, extra) of the worst run."""
        run = min(self.runs, key=lambda r: (r.matched - r.extra, -r.extra))
        return run.matched, run.expected, run.extra

    @property
    def passes(self) -> bool:
        return (
            bool(self.runs)
            and self.errors == 0
            and all(r.records_exact for r in self.runs)
            and all(self.worst(name) == 1.0 for name in DECISIVE)
        )

    @property
    def cost_per_card(self) -> float | None:
        if not self.runs or not all(r.cost_known for r in self.runs):
            return None
        cards = sum(r.cards for r in self.runs)
        return sum(r.cost for r in self.runs) / cards if cards else None

    @property
    def p50_seconds(self) -> float | None:
        seconds = [s for r in self.runs for s in r.seconds]
        return statistics.median(seconds) if seconds else None


def choose(results: list[ModelResult]) -> ModelResult | None:
    passing = [r for r in results if r.passes and r.cost_per_card is not None]
    return min(passing, key=lambda r: r.cost_per_card) if passing else None


def report(results: list[ModelResult], runs: int, when: str) -> str:
    """The markdown report: aggregate scores only, nothing read from the cards."""

    def cell(value):
        return "—" if value is None else f"{value:.2f}"

    head = ["model", "records", *REPORT_FIELDS, "cost/card", "p50 latency"]
    lines = [
        "# Card reading benchmark",
        "",
        f"Run on {when}: {runs} run(s) per model over the evaluation cards; each "
        "score is the worst run. Fields are compared after normalisation; a "
        "record is matched by kind, date and diseases.",
        "",
        "| " + " | ".join(head) + " |",
        "| " + " | ".join("---" for _ in head) + " |",
    ]
    for result in results:
        matched, expected, extra = result.worst_records
        records = f"{matched}/{expected}" + (f" (+{extra})" if extra else "")
        if result.errors:
            records += f" · {result.errors} failed call(s)"
        cost = result.cost_per_card
        p50 = result.p50_seconds
        lines.append(
            "| "
            + " | ".join(
                [
                    f"`{result.model}`",
                    records,
                    *(cell(result.worst(name)) for name in REPORT_FIELDS),
                    "—" if cost is None else f"${cost:.4f}",
                    "—" if p50 is None else f"{p50:.1f}s",
                ]
            )
            + " |"
        )
    chosen = choose(results)
    lines.append("")
    if chosen:
        lines.append(
            f"**Chosen: `{chosen.model}`**, the cheapest with 1.00 on date, repeat_on "
            "and diseases and every record found, with none extra, on every run."
        )
    else:
        lines.append(
            "**No model passed**: none had 1.00 on date, repeat_on and diseases with "
            "every record found and none extra on every run. No model is configured."
        )
    return "\n".join(lines) + "\n"
