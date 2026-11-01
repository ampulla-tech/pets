# 0003. A reminder is per animal and per disease, dated only by the vet's "repeat on"

- Status: accepted
- Date: 2026-10-31

## Context

The point of the app is not forgetting a revaccination or the next dose of a
dewormer. A vaccine's brand varies (Rabmune and Bioraiva Pet both protect
against rabies), a combined vaccine covers several diseases at once, and the
date of the next dose is written by the vet on the card, when it is written at
all. Vaccination protocols change by animal and by clinic.

## Decision

- **The reminder is derived, never typed.** For each active animal and each
  subject (a disease from the species' closed list, or the internal / external
  kind of antiparasitic), every dose with a "repeat on" date opens a reminder
  for that date, and **a later dose of the same subject closes it**. A combined
  vaccine closes the reminder of each disease it covers.
- **The date comes only from "repeat on".** The app never computes a protocol:
  that would be medical advice. A dose with no "repeat on" opens nothing; when
  it is the subject's latest dose, the app shows "no date" and asks for one.
- The states, a pure function of the doses and the day
  (`backend/reminders/logic.py`, drawn in `docs/flows/reminder.md`): `no_date`,
  `scheduled`, `upcoming` (7 days or less), `due` (the day), `overdue`,
  `closed`, `suspended` (the animal is archived).

## Consequences

- A dose loaded without its "repeat on" produces no reminder until someone
  fills it in.
- Editing a dose's "repeat on" makes it a new reminder for the sending log
  (ADR-0004): its milestones are sent again for the new date.
