"""The words of a notice: one title that says what to do and with whom, and a
second line that names the product (ADR-0009).

The same two lines go out as the push, the e-mail subject and body, and the
item in the app's notice list. Pure: an animal's name and sex, the reminders
and milestones a notice covers, and the day it is written, in; two strings out.

The reminders are per subject (ADR-0003), so a combined vaccine opens several
on one day; here they are folded back into the dose that opened them, and a
dose is one vaccine, one dewormer or one flea and tick treatment.
"""

from dataclasses import dataclass
from datetime import date

from reminders.logic import Reminder, kind_of

VACCINE = "vaccine"
INTERNAL = "internal"
EXTERNAL = "external"
KINDS = (VACCINE, INTERNAL, EXTERNAL)

# The noun of each kind, with its article, and its grammatical gender.
NOUN = {VACCINE: "a vacina", INTERNAL: "o vermífugo", EXTERNAL: "o antipulgas"}
FEMININE = {VACCINE}


@dataclass(frozen=True)
class Wording:
    title: str
    body: str


def _object(name: str, sex: str) -> str:
    """The animal as the object of a verb: "a Paçoca", "o Thor", "Paçoca"."""
    return {"female": f"a {name}", "male": f"o {name}"}.get(sex, name)


def _of(name: str, sex: str) -> str:
    """The animal as an owner: "da Paçoca", "do Thor", "de Paçoca"."""
    return {"female": f"da {name}", "male": f"do {name}"}.get(sex, f"de {name}")


def _and(parts: list[str]) -> str:
    if len(parts) <= 1:
        return "".join(parts)
    return ", ".join(parts[:-1]) + " e " + parts[-1]


def _days(n: int) -> str:
    return f"{n} {'dia' if n == 1 else 'dias'}"


def _capital(text: str) -> str:
    return text[:1].upper() + text[1:]


@dataclass(frozen=True)
class _Dose:
    kind: str
    product: str
    due_on: date


@dataclass(frozen=True)
class _Phrase:
    """The doses of one milestone that are due on the same day."""

    stage: str  # "overdue" | "due" | "early"
    due_on: date
    doses: tuple[_Dose, ...]

    @property
    def kinds(self) -> list[str]:
        present = {d.kind for d in self.doses}
        return [k for k in KINDS if k in present]

    @property
    def products(self) -> list[str]:
        seen: list[str] = []
        for kind in KINDS:
            for dose in self.doses:
                if dose.kind == kind and dose.product and dose.product not in seen:
                    seen.append(dose.product)
        return seen


def _stage(due_on: date, today: date) -> str:
    """Said from the day the notice is written, not from the milestone: a
    notice the job caught up a day late says it is late."""
    if due_on < today:
        return "overdue"
    return "due" if due_on == today else "early"


def _phrases(items: list[tuple[Reminder, str]], today: date) -> list[_Phrase]:
    """The doses grouped by due day, most urgent first: the longest overdue,
    then the day itself, then the nearest ahead."""
    doses: dict[tuple, _Dose] = {}
    for reminder, _milestone in items:
        key = (reminder.source.record_kind, reminder.source.record_id, reminder.due_on)
        doses[key] = _Dose(kind_of(reminder), reminder.source.product.strip(), reminder.due_on)
    groups: dict[tuple[str, date], list[_Dose]] = {}
    for dose in doses.values():
        groups.setdefault((_stage(dose.due_on, today), dose.due_on), []).append(dose)
    rank = {"overdue": 0, "due": 1, "early": 2}
    ordered = sorted(groups, key=lambda g: (rank[g[0]], g[1]))
    return [_Phrase(stage, due_on, tuple(groups[(stage, due_on)])) for stage, due_on in ordered]


def _sentence(phrase: _Phrase, name: str, sex: str, today: date) -> str:
    kinds = phrase.kinds
    if phrase.stage == "due":
        verbs = []
        if VACCINE in kinds:
            verbs.append("vacinar")
        given = [NOUN[k] for k in kinds if k != VACCINE]
        if given:
            verbs.append("dar " + _and(given))
        animal = _object(name, sex) if kinds == [VACCINE] else _of(name, sex)
        return f"Hoje é dia de {_and(verbs)} {animal}."
    nouns = _capital(_and([NOUN[k] for k in kinds]))
    plural = len(kinds) > 1
    whose = _of(name, sex)
    if phrase.stage == "early":
        days = (phrase.due_on - today).days
        when = "amanhã" if days == 1 else f"em {_days(days)}"
        return f"{nouns} {whose} {'vencem' if plural else 'vence'} {when}."
    late = (today - phrase.due_on).days
    if plural:
        state = "estão atrasados"
    else:
        state = "está atrasada" if kinds[0] in FEMININE else "está atrasado"
    return f"{nouns} {whose} {state} há {_days(late)}."


def _detail(phrase: _Phrase) -> str:
    products = " · ".join(phrase.products)
    if phrase.stage == "early" and VACCINE in phrase.kinds:
        return f"Já agendou? {products}." if products else "Já agendou?"
    if phrase.stage == "overdue":
        overdue = f"venceu em {phrase.due_on.strftime('%d/%m')}"
        return f"{products} · {overdue}" if products else _capital(overdue)
    return products


def word(name: str, sex: str, items: list[tuple[Reminder, str]], today: date) -> Wording:
    """The title and second line of the notice covering `items` for one animal.

    When the doses are due on different days, the most urgent one is the
    title and the others' sentences make up the second line.
    """
    phrases = _phrases(items, today)
    first, rest = phrases[0], phrases[1:]
    title = _sentence(first, name, sex, today)
    if rest:
        body = " ".join(_sentence(p, name, sex, today) for p in rest)
    else:
        body = _detail(first)
    return Wording(title, body)
