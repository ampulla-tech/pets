"""The closed list of what a dose protects against, per species.

A vaccine covers one or more diseases of its animal's species; an
antiparasitic covers internal parasites (worms) or external ones (fleas and
ticks). These codes are the reminder's subjects: two vaccines of different
brands that cover the same disease count as the same thing. The labels are the
on-screen text, also used in the reminder e-mail and the PDF.
"""

from typing import Literal

DOG = "dog"
CAT = "cat"

DISEASES: dict[str, list[tuple[str, str]]] = {
    DOG: [
        ("distemper", "Cinomose"),
        ("infectious_hepatitis", "Hepatite infecciosa"),
        ("parvovirus", "Parvovirose"),
        ("parainfluenza", "Parainfluenza"),
        ("leptospirosis", "Leptospirose"),
        ("coronavirus", "Coronavirose"),
        ("rabies", "Raiva"),
        ("kennel_cough", "Tosse dos canis"),
        ("canine_influenza", "Gripe canina"),
        ("giardia", "Giárdia"),
        ("leishmaniasis", "Leishmaniose"),
    ],
    CAT: [
        ("rhinotracheitis", "Rinotraqueíte"),
        ("calicivirus", "Calicivirose"),
        ("panleukopenia", "Panleucopenia"),
        ("chlamydiosis", "Clamidiose"),
        ("felv", "FeLV"),
        ("rabies", "Raiva"),
    ],
}

PARASITES: list[tuple[str, str]] = [
    ("internal", "Verme interno"),
    ("external", "Pulga e carrapato"),
]

DiseaseCode = Literal[
    "distemper",
    "infectious_hepatitis",
    "parvovirus",
    "parainfluenza",
    "leptospirosis",
    "coronavirus",
    "rabies",
    "kennel_cough",
    "canine_influenza",
    "giardia",
    "leishmaniasis",
    "rhinotracheitis",
    "calicivirus",
    "panleukopenia",
    "chlamydiosis",
    "felv",
]

ParasiteKind = Literal["internal", "external"]


def codes_for(species: str) -> list[str]:
    return [code for code, _ in DISEASES[species]]


def label(code: str) -> str:
    """The on-screen name of a reminder subject (a disease or a parasite kind)."""
    for entries in (*DISEASES.values(), PARASITES):
        for entry_code, entry_label in entries:
            if entry_code == code:
                return entry_label
    return code


def subject_order(species: str) -> list[str]:
    """Every subject an animal of this species can have, in display order."""
    return [*codes_for(species), *(code for code, _ in PARASITES)]
