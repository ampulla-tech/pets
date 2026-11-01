"""The reminders of real animals: their records turned into doses."""

from datetime import date

from animals.models import Animal, AnimalStatus, Antiparasitic, Vaccine
from reminders.logic import Dose, Reminder, reminders_for


def doses_of(animal: Animal) -> list[Dose]:
    doses: list[Dose] = []
    for vaccine in Vaccine.objects.filter(animal=animal):
        for disease in vaccine.diseases:
            doses.append(
                Dose(
                    subject=disease,
                    date=vaccine.date,
                    repeat_on=vaccine.repeat_on,
                    record_kind="vaccine",
                    record_id=str(vaccine.id),
                    sequence=vaccine.created_at.timestamp(),
                )
            )
    for treatment in Antiparasitic.objects.filter(animal=animal):
        doses.append(
            Dose(
                subject=treatment.kind,
                date=treatment.date,
                repeat_on=treatment.repeat_on,
                record_kind="antiparasitic",
                record_id=str(treatment.id),
                sequence=treatment.created_at.timestamp(),
            )
        )
    return doses


def reminders_of(animal: Animal, today: date) -> list[Reminder]:
    return reminders_for(doses_of(animal), today, archived=animal.status == AnimalStatus.ARCHIVED)
