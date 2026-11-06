"""The card for the vet who does not use the app: one row per subject, and its PDF.

A row per disease (and per kind of antiparasitic) the animal has a dose of:
the last dose (date, product, vet) and the next one (its "repeat on"), with the
photo of the label when the dose has one. Only someone with access to the
animal gets it: there is no public link and no QR code.
"""

import io
from dataclasses import dataclass
from datetime import date

from django.utils import timezone

from animals.age import age_of
from animals.diseases import label, subject_order
from animals.models import Animal, Antiparasitic, Attachment, Vaccine
from reminders.logic import State
from reminders.service import reminders_of


@dataclass
class CardRow:
    subject: str
    label: str
    last_date: date
    last_product: str
    last_vet: str
    next_on: date | None
    state: str
    record_kind: str
    record_id: str
    photos: list[Attachment]


def card_rows(animal: Animal, today: date | None = None) -> list[CardRow]:
    today = today or timezone.localdate()
    reminders = reminders_of(animal, today)
    latest: dict[str, object] = {}
    records = {
        **{("vaccine", str(v.id)): v for v in Vaccine.objects.filter(animal=animal)},
        **{("antiparasitic", str(a.id)): a for a in Antiparasitic.objects.filter(animal=animal)},
    }
    for reminder in reminders:
        if reminder.state == State.CLOSED:
            continue
        latest[reminder.subject] = reminder
    rows = []
    order = subject_order(animal.species)
    for subject in sorted(latest, key=lambda s: order.index(s) if s in order else 99):
        reminder = latest[subject]
        record = records[(reminder.source.record_kind, reminder.source.record_id)]
        product = record.brand if isinstance(record, Vaccine) else record.product
        rows.append(
            CardRow(
                subject=subject,
                label=label(subject),
                last_date=record.date,
                last_product=product,
                last_vet=record.vet_name,
                next_on=reminder.due_on,
                state=reminder.state.value,
                record_kind=reminder.source.record_kind,
                record_id=reminder.source.record_id,
                photos=[a for a in record.attachments.all() if a.is_image],
            )
        )
    return rows


# ── PDF ─────────────────────────────────────────────────────────────────────

SPECIES = {"dog": "Canino", "cat": "Felino"}
# A blank breed is shown as "sem raça definida", the same as one typed "SRD".
NO_BREED = "SRD (sem raça definida)"
SEX = {"male": "Macho", "female": "Fêmea", "": "—"}


def breed_text(breed: str) -> str:
    """The breed in the PDF: blank or "SRD" reads "SRD (sem raça definida)"."""
    breed = breed.strip()
    return NO_BREED if breed.upper() in ("", "SRD") else breed


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
    from reportlab.lib.units import mm
    from reportlab.platypus import (
        Image,
        KeepTogether,
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

    rows = card_rows(animal, today)
    story.append(Paragraph("Vacinas e antiparasitários", styles["Heading2"]))
    if not rows:
        story.append(Paragraph("Nenhuma dose registrada.", styles["Normal"]))
    else:
        data = [["Contra", "Última dose", "Produto", "Veterinário", "Próxima"]]
        for row in rows:
            data.append(
                [
                    row.label,
                    _br(row.last_date),
                    row.last_product or "—",
                    row.last_vet or "—",
                    _br(row.next_on) if row.next_on else "sem data",
                ]
            )
        grid = Table(data, colWidths=[34 * mm, 26 * mm, 44 * mm, 40 * mm, 26 * mm], repeatRows=1)
        grid.setStyle(
            TableStyle(
                [
                    ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
                    ("FONTSIZE", (0, 0), (-1, -1), 8.5),
                    ("GRID", (0, 0), (-1, -1), 0.4, colors.grey),
                    ("BACKGROUND", (0, 0), (-1, 0), colors.whitesmoke),
                    ("VALIGN", (0, 0), (-1, -1), "TOP"),
                ]
            )
        )
        story.append(grid)

    photos: list[Attachment] = []
    for row in rows:
        for photo in row.photos:
            if photo not in photos:
                photos.append(photo)
    if photos:
        story += [Spacer(1, 6 * mm), Paragraph("Fotos das etiquetas", styles["Heading2"])]
        for photo in photos:
            with photo.file.open("rb") as handle:
                image = Image(io.BytesIO(handle.read()))
            ratio = image.imageHeight / image.imageWidth
            width = min(170 * mm, 120 * mm / ratio)
            image.drawWidth, image.drawHeight = width, width * ratio
            story.append(KeepTogether([image, Spacer(1, 4 * mm)]))

    story += [Spacer(1, 4 * mm), Paragraph(f"Gerado em {_br(today)} pelo Pets.", styles["Italic"])]
    doc.build(story)
    return out.getvalue()
