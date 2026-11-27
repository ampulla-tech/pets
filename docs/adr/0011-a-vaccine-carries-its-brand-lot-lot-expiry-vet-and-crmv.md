# 0011. A vaccine carries its brand, lot, lot expiry, vet and CRMV

- Status: accepted
- Date: 2026-11-27

## Context

The paper card is accepted at the clinic's counter because of two things on
each dose: the label of the bottle (brand, lot, lot expiry) and the vet's stamp
(name and CRMV). The app let a vaccine be saved without any of them: in
`VaccineIn`, and so in the reading's `VaccineConfirm`, they were optional text
defaulting to empty, and the forms marked them "(opcional)". A dose could
therefore be recorded without what makes it count.

## Decision

- **Brand, lot, lot expiry, vet name and vet CRMV are required on every save
  of a vaccine**: creating, editing, and confirming a line of a reading
  (`VaccineConfirm` inherits `VaccineIn`). Brand, lot, vet name and CRMV must
  hold text once the spaces at their ends are taken off; the API stores them
  without those spaces. The lot expiry must be a month, YYYY-MM: the rule of
  ADR-0010, in `animals/months.py`, without the empty value it allowed.
- **A save without one of them is the API's usual validation error (422) on
  that field.** The web and the native app check the same five before sending,
  each with its own message under the field, so a person meets the 422 only
  from another client.
- **Nothing is migrated.** A vaccine stored before this decision with any of
  the five empty is still valid to read: `VaccineOut` does not change and
  sends the empty string, and the card names such a dose by its diseases.
  Completing it is asked for the next time it is saved.
- This decision narrows ADR-0010 for the vaccine and does not supersede it:
  the lot expiry is still a calendar month.

The path of a save is drawn in [`docs/flows/vaccine-save.md`](../flows/vaccine-save.md).

## Consequences

- Every vaccine saved from now on carries what the counter checks.
- Editing an old dose, even only to change its "repeat on", requires filling
  in what it lacks.
- The format of the CRMV (state and number) and of the lot is not checked:
  any non-blank text is accepted.
- The native app no longer keeps an old lot expiry that is not a month as it
  was: every stored value is a month or empty since ADR-0010's migration, and
  empty is now refused.
