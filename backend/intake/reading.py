"""Reading a vaccination card from its photos (ADR-0005).

A LangGraph graph over OpenRouter: one node asks a vision model for the card's
records as structured output (`json_schema`, image blocks), the next cleans
what came back against the domain: diseases outside the species' closed list
are dropped, a value the model could not read is emptied, dates that are not
dates are marked unread. The model proposes; nothing here writes a record.

Every field of a proposal is `{value, read}`: `read: false` means the model
could not read it, and its value is then always empty, never guessed. The
"repeat on" date also says where it came from: `written` in its own box, or
`inferred` from a lone future date on the line below.
"""

import base64
import re
import time
from dataclasses import dataclass, field
from datetime import date
from typing import Any, Literal, TypedDict

from pydantic import BaseModel, ConfigDict, Field

from animals.diseases import DISEASES, PARASITES, codes_for
from animals.months import is_month

# ── The structured output ───────────────────────────────────────────────────


class Strict(BaseModel):
    """Every object closed (`additionalProperties: false`): OpenAI's strict
    json_schema mode rejects a schema without it."""

    model_config = ConfigDict(extra="forbid")


class TextValue(Strict):
    value: str | None = Field(description="The text as written, or null.")
    read: bool = Field(description="False when the field exists but is illegible or blank.")


class DateValue(Strict):
    value: str | None = Field(description="ISO date YYYY-MM-DD, or null.")
    read: bool


class RepeatOnValue(Strict):
    value: str | None = Field(description="ISO date YYYY-MM-DD, or null.")
    read: bool
    origin: Literal["written", "inferred"] | None = Field(
        description="written: in the record's own 'repeat on' box; inferred: from a "
        "lone future date on the line just below; null when there is no value."
    )


class CodesValue(Strict):
    value: list[str] = Field(description="Codes from the closed list given.")
    read: bool


class NumberValue(Strict):
    value: float | None
    read: bool


class ProposedRecord(Strict):
    kind: Literal["vaccine", "antiparasitic", "weight"]
    date: DateValue
    brand: TextValue = Field(description="Product name on the label (e.g. Nobivac Raiva).")
    lot: TextValue = Field(description="Lot / batch (partida) as printed.")
    lot_expiry: TextValue = Field(description="Lot expiry as YYYY-MM (MAI/26 is 2026-05).")
    diseases: CodesValue = Field(
        description="vaccine: the disease codes it covers; antiparasitic: "
        "['internal'] for worms or ['external'] for fleas and ticks; weight: []."
    )
    repeat_on: RepeatOnValue
    vet_name: TextValue
    vet_crmv: TextValue = Field(description="The CRMV as printed, e.g. CRMV-SC 12345.")
    dose: TextValue
    weight_kg: NumberValue = Field(description="Only for kind=weight: kilograms.")


class CardReading(Strict):
    proposals: list[ProposedRecord]


# ── The prompt ──────────────────────────────────────────────────────────────

RULES = """\
You read photos of a Brazilian pet vaccination card (carteirinha de vacinação)
and return every record on it. Rules:

1. Two labels (stickers) of the same application are ONE record. Some vaccines
   come in two vials mixed into a single dose (e.g. Nobivac DHPPi+L, Nobivac
   Feline 1-HCPCh+FeLV, Felocell CVR-C), each with its own label.
2. A blank field on the card comes back empty with read=false. Never invent.
3. A line holding only a future date, with no vaccine and no signature, right
   below a vaccine with no "repeat on" date, is that vaccine's "repeat on":
   set repeat_on.origin = "inferred". A date in the record's own box is
   "written".
4. A crossed-out or overwritten field comes back with its final reading (the
   digit written on top), with no mark.
5. A weight written inside a vaccine's box, or in a corner of the cover, is a
   separate record of kind "weight" on the corresponding date.
6. Diseases come only from the closed list below; they may be inferred from
   the letters of the product name (D distemper, H hepatitis, P parvovirus,
   Pi parainfluenza, L leptospirosis, C coronavirus in dogs / calicivirus in
   cats, Ch chlamydiosis, FeLV, R rhinotracheitis in cats). In a cat vaccine
   named "CVR-C" (e.g. Felocell CVR-C), C-V-R is calicivirus, panleukopenia
   (viral enteritis) and rhinotracheitis, and the trailing "-C" is
   chlamydiosis.
7. A two-digit year is 20xx. A crossed 7 (written like a 4 with a bar) is a 7.

Dates are ISO (YYYY-MM-DD). A field you cannot read: value null, read false.
Return the records in the card's order. Do not return the animal's profile.
"""


def system_prompt(species: str) -> str:
    diseases = "\n".join(f"- {code}: {label}" for code, label in DISEASES[species])
    parasites = "\n".join(f"- {code}: {label}" for code, label in PARASITES)
    animal = "dog" if species == "dog" else "cat"
    return (
        f"{RULES}\nThe animal is a {animal}. Vaccine disease codes:\n{diseases}\n"
        f"Antiparasitic codes (kind=antiparasitic):\n{parasites}\n"
    )


# ── Cleaning ────────────────────────────────────────────────────────────────

_ISO = re.compile(r"^\d{4}-\d{2}-\d{2}$")


def _empty(extra: dict | None = None) -> dict:
    return {"value": None, "read": False, **(extra or {})}


def _text(field_: dict) -> dict:
    value = (field_.get("value") or "").strip() if isinstance(field_, dict) else ""
    if not value or not field_.get("read", False):
        return _empty()
    return {"value": value, "read": True}


def _month(field_: dict) -> dict:
    """A lot expiry: YYYY-MM or unread, so the API never receives another form (ADR-0010)."""
    cleaned = _text(field_)
    return cleaned if cleaned["read"] and is_month(cleaned["value"]) else _empty()


def _date(field_: dict) -> dict:
    value = (field_.get("value") or "").strip() if isinstance(field_, dict) else ""
    if not field_.get("read", False) or not _ISO.match(value):
        return _empty()
    try:
        date.fromisoformat(value)
    except ValueError:
        return _empty()
    return {"value": value, "read": True}


def clean(proposal: dict, species: str) -> dict:
    kind = proposal.get("kind")
    out: dict[str, Any] = {"kind": kind}
    out["date"] = _date(proposal.get("date") or {})
    for name in ("brand", "lot", "vet_name", "vet_crmv", "dose"):
        out[name] = _text(proposal.get(name) or {})
    out["lot_expiry"] = _month(proposal.get("lot_expiry") or {})
    repeat = proposal.get("repeat_on") or {}
    cleaned = _date(repeat)
    origin = repeat.get("origin") if cleaned["read"] else None
    out["repeat_on"] = {**cleaned, "origin": origin or ("written" if cleaned["read"] else None)}
    codes = (proposal.get("diseases") or {}).get("value") or []
    allowed = (
        codes_for(species)
        if kind == "vaccine"
        else [code for code, _ in PARASITES]
        if kind == "antiparasitic"
        else []
    )
    kept = [code for code in dict.fromkeys(codes) if code in allowed]
    out["diseases"] = {"value": kept, "read": bool(kept)}
    weight = proposal.get("weight_kg") or {}
    try:
        kg = float(weight.get("value")) if weight.get("read") else None
    except (TypeError, ValueError):
        kg = None
    out["weight_kg"] = {"value": kg if kg and kg > 0 else None, "read": bool(kg and kg > 0)}
    return out


# ── The graph ───────────────────────────────────────────────────────────────


@dataclass
class Photo:
    data: bytes
    mime_type: str = "image/jpeg"


@dataclass
class ReadResult:
    proposals: list[dict]
    model: str
    cost: float | None = None
    seconds: float = 0.0
    raw: Any = field(default=None, repr=False)


class ReadState(TypedDict, total=False):
    photos: list[Photo]
    species: str
    reading: dict
    cost: float | None
    proposals: list[dict]


def build_graph(llm):
    """The two-node graph over a chat model (a ChatOpenRouter, or a fake in tests)."""
    from langchain_core.messages import HumanMessage, SystemMessage
    from langgraph.graph import END, START, StateGraph

    structured = llm.with_structured_output(CardReading, method="json_schema", include_raw=True)

    def read_card(state: ReadState) -> ReadState:
        content: list[dict] = [
            {"type": "text", "text": "These are the photos of one card, in order."}
        ]
        for photo in state["photos"]:
            content.append(
                {
                    "type": "image",
                    "base64": base64.b64encode(photo.data).decode(),
                    "mime_type": photo.mime_type,
                }
            )
        answer = structured.invoke(
            [SystemMessage(system_prompt(state["species"])), HumanMessage(content=content)]
        )
        if answer.get("parsing_error") or answer.get("parsed") is None:
            raise ReadingFailed(f"unparseable answer: {answer.get('parsing_error')}")
        raw = answer.get("raw")
        cost = getattr(raw, "response_metadata", {}).get("cost") if raw is not None else None
        parsed = answer["parsed"]
        return {"reading": parsed.model_dump(), "cost": cost}

    def tidy(state: ReadState) -> ReadState:
        proposals = [clean(p, state["species"]) for p in state["reading"].get("proposals", [])]
        return {"proposals": [p for p in proposals if p["kind"] in RECORD_KINDS]}

    graph = StateGraph(ReadState)
    graph.add_node("read_card", read_card)
    graph.add_node("tidy", tidy)
    graph.add_edge(START, "read_card")
    graph.add_edge("read_card", "tidy")
    graph.add_edge("tidy", END)
    return graph.compile()


RECORD_KINDS = {"vaccine", "antiparasitic", "weight"}


class ReadingFailed(Exception):
    pass


class ReadingUnconfigured(ReadingFailed):
    pass


MAX_OUTPUT_TOKENS = 16_000


def openrouter_model(model: str, api_key: str, timeout: int = 120):
    from langchain_openrouter import ChatOpenRouter

    # A card's answer is a few thousand tokens; an explicit cap keeps OpenRouter
    # from reserving the model's full output window against the key's credit.
    return ChatOpenRouter(
        model=model,
        api_key=api_key,
        temperature=0,
        max_tokens=MAX_OUTPUT_TOKENS,
        timeout=timeout * 1000,
    )


def read_card(
    photos: list[Photo], species: str, model: str, api_key: str, llm=None, timeout: int = 120
) -> ReadResult:
    if llm is None:
        if not model or not api_key:
            raise ReadingUnconfigured("the reading model or its key is not configured")
        llm = openrouter_model(model, api_key, timeout)
    started = time.monotonic()
    state = build_graph(llm).invoke({"photos": photos, "species": species})
    return ReadResult(
        proposals=state["proposals"],
        model=model,
        cost=state.get("cost"),
        seconds=time.monotonic() - started,
    )
