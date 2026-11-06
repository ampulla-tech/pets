"""The card: everything recorded of an animal, a line per record, and its PDF.

Like the paper card the vet stamps, it has a section per kind (vaccines,
antiparasitics, visits, weights, notes), the newest record first, and a
section with no record is left out. Only the current dose (a vaccine or an
antiparasitic with a reminder not yet closed) says when to repeat it, with the
home badge's rule for its state: overdue, or due within 30 days. A dose a later
one replaced is an old dose, shown without its "repeat on". The PDF is the same
sections without the notes and without photos. Only someone with access to the
animal gets either: there is no public link and no QR code.
"""

import io
from dataclasses import dataclass, field
from datetime import date
from decimal import Decimal
from xml.sax.saxutils import escape

from django.utils import timezone
from reportlab.lib.units import mm

from animals.age import age_of
from animals.diseases import PARASITES, label
from animals.models import (
    Animal,
    AnimalStatus,
    Antiparasitic,
    Note,
    Record,
    Vaccine,
    Visit,
    Weight,
)
from reminders.logic import BADGE_WINDOW, State
from reminders.service import reminders_of

SECTIONS: list[tuple[str, type[Record]]] = [
    ("vaccine", Vaccine),
    ("antiparasitic", Antiparasitic),
    ("visit", Visit),
    ("weight", Weight),
    ("note", Note),
]
PARASITE_LABEL = dict(PARASITES)


@dataclass
class CardItem:
    record: Record
    title: str
    detail: str
    # Only a current dose has these; an old dose and any other record do not.
    current: bool = False
    repeat_on: date | None = None
    state: str | None = None  # "ok" | "due_soon" | "overdue" | "no_date"
    due_in_days: int | None = None
    # What the PDF puts in a column of its own: what an antiparasitic is against.
    against: str = ""


@dataclass
class CardSection:
    kind: str
    items: list[CardItem] = field(default_factory=list)


def kg_text(kg: Decimal) -> str:
    """ "8,4 kg", the way the screens write a weight."""
    return f"{Decimal(kg).normalize():f}".replace(".", ",") + " kg"


def _join(*parts: str) -> str:
    return " · ".join(p for p in parts if p)


def _dose_state(repeat_on: date | None, today: date, archived: bool):
    if repeat_on is None:
        return "no_date", None
    days = (repeat_on - today).days
    if archived:
        return None, days
    if days < 0:
        return "overdue", days
    if days <= BADGE_WINDOW.days:
        return "due_soon", days
    return "ok", days


def card_sections(animal: Animal, today: date | None = None) -> list[CardSection]:
    today = today or timezone.localdate()
    archived = animal.status == AnimalStatus.ARCHIVED
    current = {
        (r.source.record_kind, r.source.record_id)
        for r in reminders_of(animal, today)
        if r.state != State.CLOSED
    }
    # The weight taken with an antiparasitic says where it came from.
    with_treatment = {
        a.weight_id: a for a in Antiparasitic.objects.filter(animal=animal, weight__isnull=False)
    }
    sections = []
    for kind, model in SECTIONS:
        queryset = model.objects.filter(animal=animal).order_by("-date", "-created_at")
        if model is Antiparasitic:
            queryset = queryset.select_related("weight")
        if model is Note:
            queryset = queryset.select_related("created_by")
        if model is Visit:
            queryset = queryset.prefetch_related("attachments")
        items = []
        for record in queryset:
            item = _item(record, with_treatment)
            if kind in ("vaccine", "antiparasitic") and (kind, str(record.id)) in current:
                item.current = True
                item.repeat_on = record.repeat_on
                item.state, item.due_in_days = _dose_state(record.repeat_on, today, archived)
            items.append(item)
        if items:
            sections.append(CardSection(kind, items))
    return sections


def _files(count: int) -> str:
    if not count:
        return ""
    return "1 arquivo" if count == 1 else f"{count} arquivos"


def _item(record: Record, with_treatment: dict) -> CardItem:
    if isinstance(record, Vaccine):
        diseases = ", ".join(label(code) for code in record.diseases)
        lot = f"Partida {record.lot}" if record.lot else ""
        return CardItem(record, record.brand or diseases, _join(lot, record.vet_name))
    if isinstance(record, Antiparasitic):
        against = PARASITE_LABEL.get(record.kind, record.kind)
        weight = kg_text(record.weight.kg) if record.weight else ""
        if not record.product:
            return CardItem(
                record, against, _join(record.dose, weight, record.vet_name), against=against
            )
        detail = _join(against, record.dose, weight, record.vet_name)
        return CardItem(record, record.product, detail, against=against)
    if isinstance(record, Visit):
        files = _files(len(record.attachments.all()))
        return CardItem(
            record, record.clinic or "Consulta", _join(record.reason, record.vet_name, files)
        )
    if isinstance(record, Weight):
        treatment = with_treatment.get(record.id)
        source = ""
        if treatment is not None:
            source = f"Com o {treatment.product or 'antiparasitário'}"
        return CardItem(record, kg_text(record.kg), source)
    author = record.created_by.email if record.created_by else ""
    return CardItem(record, record.text, author)


# ── PDF ─────────────────────────────────────────────────────────────────────

SPECIES = {"dog": "Canino", "cat": "Felino"}
# A blank breed is shown as "sem raça definida", the same as one typed "SRD".
NO_BREED = "SRD (sem raça definida)"
SEX = {"male": "Macho", "female": "Fêmea", "": "—"}


def breed_text(breed: str) -> str:
    """The breed in the PDF: blank or "SRD" reads "SRD (sem raça definida)"."""
    breed = breed.strip()
    return NO_BREED if breed.upper() in ("", "SRD") else breed


# Each section of the PDF: its heading, its header row and its column widths (mm).
PDF_SECTIONS = {
    "vaccine": ("Vacinas", ["Data", "Vacina", "Repetir em"], [26 * mm, 118 * mm, 26 * mm]),
    "antiparasitic": (
        "Antiparasitários",
        ["Data", "Produto", "Contra", "Repetir em"],
        [26 * mm, 74 * mm, 44 * mm, 26 * mm],
    ),
    "visit": ("Consultas e exames", None, [26 * mm, 144 * mm]),
    "weight": ("Peso", None, [26 * mm, 144 * mm]),
}


def _dose(item: CardItem) -> bool:
    return isinstance(item.record, Vaccine | Antiparasitic)


def _br(day: date | None) -> str:
    return day.strftime("%d/%m/%Y") if day else "—"


def _age_text(animal: Animal, today: date) -> str:
    age = age_of(animal.birth_precision, animal.birth_date, today)
    if age is None:
        return "—"
    parts = []
    if age.years:
        parts.append(f"{age.years} {'ano' if age.years == 1 else 'anos'}")
    if age.months:
        parts.append(f"{age.months} {'mês' if age.months == 1 else 'meses'}")
    text = " e ".join(parts) or "menos de 1 mês"
    return f"cerca de {text}" if age.approximate else text


def card_pdf(animal: Animal, today: date | None = None) -> bytes:
    from reportlab.lib import colors
    from reportlab.lib.pagesizes import A4
    from reportlab.lib.styles import getSampleStyleSheet
    from reportlab.platypus import (
        Paragraph,
        SimpleDocTemplate,
        Spacer,
        Table,
        TableStyle,
    )

    today = today or timezone.localdate()
    styles = getSampleStyleSheet()
    out = io.BytesIO()
    doc = SimpleDocTemplate(
        out,
        pagesize=A4,
        leftMargin=18 * mm,
        rightMargin=18 * mm,
        topMargin=16 * mm,
        bottomMargin=16 * mm,
        title=f"Carteirinha de {animal.name}",
    )
    story = [Paragraph(f"Carteirinha de {animal.name}", styles["Title"])]

    profile = [
        ["Espécie", SPECIES[animal.species], "Raça", breed_text(animal.breed)],
        [
            "Sexo",
            SEX.get(animal.sex, "—"),
            "Castrado",
            {True: "Sim", False: "Não", None: "—"}[animal.neutered],
        ],
        ["Idade", _age_text(animal, today), "Pelagem", animal.coat or "—"],
        ["Microchip", animal.microchip or "—", "Adoção", _br(animal.adopted_on)],
    ]
    table = Table(profile, colWidths=[28 * mm, 57 * mm, 28 * mm, 57 * mm])
    table.setStyle(
        TableStyle(
            [
                ("FONTNAME", (0, 0), (0, -1), "Helvetica-Bold"),
                ("FONTNAME", (2, 0), (2, -1), "Helvetica-Bold"),
                ("FONTSIZE", (0, 0), (-1, -1), 9),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
            ]
        )
    )
    story += [table, Spacer(1, 6 * mm)]

    sections = [section for section in card_sections(animal, today) if section.kind != "note"]
    if not sections:
        story.append(Paragraph("Nenhum registro.", styles["Normal"]))
    small = styles["Normal"].clone("small", fontSize=8.5, leading=10.5)
    faint = small.clone("faint", textColor=colors.grey)

    def cell(text: str, item: CardItem) -> Paragraph:
        return Paragraph(escape(text) or "—", small if item.current or not _dose(item) else faint)

    def repeat(item: CardItem) -> str:
        if not item.current:
            return "—"
        return _br(item.repeat_on) if item.repeat_on else "sem data"

    for section in sections:
        heading, header, widths = PDF_SECTIONS[section.kind]
        data = [header] if header else []
        for item in section.items:
            day = cell(_br(item.record.date), item)
            if section.kind == "vaccine":
                name = escape(item.title or "—")
                if item.detail:
                    name += f'<br/><font color="grey">{escape(item.detail)}</font>'
                style = small if item.current else faint
                data.append([day, Paragraph(name, style), cell(repeat(item), item)])
            elif section.kind == "antiparasitic":
                data.append(
                    [
                        day,
                        cell(item.record.product or "—", item),
                        cell(item.against, item),
                        cell(repeat(item), item),
                    ]
                )
            else:
                data.append([day, cell(_join(item.title, item.detail), item)])
        grid = Table(data, colWidths=widths, repeatRows=1 if header else 0)
        commands = [
            ("VALIGN", (0, 0), (-1, -1), "TOP"),
            ("LINEBELOW", (0, 0), (-1, -1), 0.3, colors.lightgrey),
        ]
        if header:
            commands += [
                ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
                ("FONTSIZE", (0, 0), (-1, 0), 8.5),
                ("TEXTCOLOR", (0, 0), (-1, 0), colors.grey),
            ]
        grid.setStyle(TableStyle(commands))
        story += [Paragraph(heading, styles["Heading3"]), grid]

    story += [Spacer(1, 4 * mm), Paragraph(f"Gerado em {_br(today)} pelo Pets.", styles["Italic"])]
    doc.build(story)
    return out.getvalue()
