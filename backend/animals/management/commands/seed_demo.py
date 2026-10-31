"""Fill a local database with three animals and their cards, for development.

    uv run python manage.py seed_demo --email demo@example.com --password ...

The animals and the dates mirror real cards; vets, lots' owners and the
microchip are made up. Refused unless DEBUG is on.
"""

from datetime import date
from decimal import Decimal

from django.conf import settings
from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand, CommandError

from animals.models import Access, Animal, Antiparasitic, Note, Role, Vaccine, Weight

FELINE = ["rhinotracheitis", "calicivirus", "panleukopenia", "chlamydiosis"]
DHPPI_L = ["distemper", "infectious_hepatitis", "parvovirus", "parainfluenza", "leptospirosis"]
VET = ("Dra. Exemplo", "CRMV-SC 00001")


class Command(BaseCommand):
    help = "Create a demo account with three animals and their records (DEBUG only)."

    def add_arguments(self, parser):
        parser.add_argument("--email", default="demo@example.com")
        parser.add_argument("--password", default="pets-demo-2026")

    def handle(self, *args, **options):
        if not settings.DEBUG:
            raise CommandError("seed_demo runs only with DEBUG on")
        user_model = get_user_model()
        user, created = user_model.objects.get_or_create(email=options["email"])
        if created:
            user.set_password(options["password"])
            user.save()
        for access in Access.objects.filter(user=user):
            access.animal.delete()

        def animal(**fields):
            pet = Animal.objects.create(**fields)
            Access.objects.create(animal=pet, user=user, role=Role.TUTOR)
            return pet

        def vaccine(pet, day, brand, diseases, repeat, lot="", expiry="", origin="written"):
            Vaccine.objects.create(
                animal=pet,
                date=day,
                brand=brand,
                diseases=diseases,
                repeat_on=repeat,
                repeat_on_origin=origin if repeat else "",
                lot=lot,
                lot_expiry=expiry,
                vet_name=VET[0],
                vet_crmv=VET[1],
                created_by=user,
                updated_by=user,
            )

        bug = animal(
            species="dog",
            name="Bug",
            breed="Dachshund",
            sex="male",
            birth_precision="exact",
            birth_date=date(2026, 9, 1),
            adopted_on=date(2026, 10, 10),
        )
        vaccine(
            bug,
            date(2026, 10, 16),
            "Nobivac DHPPi+L",
            DHPPI_L,
            date(2026, 11, 6),
            "011/25",
            "2027-02",
            "inferred",
        )
        for day, repeat in (
            (date(2026, 10, 13), date(2026, 10, 21)),
            (date(2026, 10, 22), date(2026, 10, 23)),
        ):
            Antiparasitic.objects.create(
                animal=bug,
                date=day,
                kind="internal",
                product="Drontal",
                dose="1 mL",
                repeat_on=repeat,
                repeat_on_origin="written",
                created_by=user,
                updated_by=user,
            )
        Weight.objects.create(
            animal=bug, date=date(2026, 10, 16), kg=Decimal("3.1"), created_by=user, updated_by=user
        )

        gata = animal(
            species="cat",
            name="GATA",
            breed="SRD",
            sex="female",
            coat="Bege e marrom",
            birth_precision="unknown",
        )
        vaccine(
            gata,
            date(2025, 7, 3),
            "Nobivac Raiva",
            ["rabies"],
            date(2026, 7, 3),
            "007/24",
            "2026-05",
        )
        vaccine(
            gata,
            date(2025, 7, 3),
            "Nobivac Feline 1-HCPCh+FeLV",
            [*FELINE, "felv"],
            date(2025, 7, 24),
            "004/24",
            "2026-01",
        )
        vaccine(
            gata,
            date(2025, 7, 28),
            "Nobivac Feline 1-HCPCh+FeLV",
            [*FELINE, "felv"],
            date(2026, 7, 28),
            "004/24",
            "2026-01",
        )
        vaccine(
            gata,
            date(2026, 10, 5),
            "Felocell FeLV",
            ["felv"],
            date(2027, 10, 5),
            "001/25",
            "2026-11",
        )
        vaccine(
            gata,
            date(2026, 10, 5),
            "Felocell CVR-C",
            FELINE,
            date(2027, 10, 5),
            "009/25",
            "2027-04",
        )
        vaccine(
            gata, date(2026, 10, 5), "Rabmune", ["rabies"], date(2027, 10, 5), "014/25", "2027-06"
        )
        Weight.objects.create(
            animal=gata,
            date=date(2025, 7, 3),
            kg=Decimal("4.285"),
            created_by=user,
            updated_by=user,
        )

        lacan = animal(
            species="cat",
            name="Lacan",
            breed="SRD",
            sex="male",
            microchip="000000000000000",
            birth_precision="unknown",
        )
        vaccine(
            lacan,
            date(2026, 5, 18),
            "Felocell CVR-C",
            FELINE,
            date(2026, 6, 8),
            "007/25",
            "2027-02",
        )
        vaccine(
            lacan, date(2026, 6, 6), "Felocell CVR-C", FELINE, date(2027, 6, 6), "007/25", "2027-02"
        )
        vaccine(
            lacan,
            date(2026, 6, 6),
            "Bioraiva Pet",
            ["rabies"],
            date(2027, 6, 6),
            "011/25",
            "2027-09",
        )
        vaccine(
            lacan,
            date(2026, 10, 5),
            "Felocell FeLV",
            ["felv"],
            date(2026, 10, 26),
            "001/25",
            "2026-11",
        )
        vaccine(
            lacan,
            date(2026, 10, 27),
            "Felocell FeLV",
            ["felv"],
            date(2027, 10, 27),
            "001/25",
            "2026-11",
        )
        for day, kg in (
            (date(2026, 5, 18), "4.1"),
            (date(2026, 6, 6), "4.4"),
            (date(2026, 8, 2), "4.9"),
        ):
            Weight.objects.create(
                animal=lacan, date=day, kg=Decimal(kg), created_by=user, updated_by=user
            )
        Note.objects.create(
            animal=lacan,
            date=date(2026, 10, 27),
            text="Ficou quietinho na volta.",
            created_by=user,
            updated_by=user,
        )
        self.stdout.write(f"seeded {options['email']} with Bug, GATA and Lacan")
