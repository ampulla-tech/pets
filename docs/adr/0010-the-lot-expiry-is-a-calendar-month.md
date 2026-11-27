# 0010. The lot expiry is a calendar month

- Status: accepted
- Date: 2026-11-27

## Context

A vaccine label prints the lot's expiry as a month ("09/2027", "SET/27"). The
API stored it as free text: `VaccineIn.lot_expiry` took any string, and the
card's reading kept whatever the model returned, although its prompt asks for
YYYY-MM. Each client then wrote and read the field its own way: the native app
masks "MM/AAAA" and sends YYYY-MM, the web accepted "MM/AAAA" typed into a
numeric keypad that has no "/", so a tutor on a phone could not fill it in at
all.

## Decision

- **The lot expiry is YYYY-MM, with a month from 01 to 12, or empty.** That is
  the contract of `VaccineIn.lot_expiry`; anything else is the API's usual
  validation error on that field. The rule is written once, in
  `animals/months.py`, and every way in uses it.
- **The column stays a `CharField`.** The contract is enforced where the value
  comes in, not by the column type, so no schema change is needed.
- **What is already stored is migrated** (`animals/0002`): "M/AAAA",
  "MM/AAAA" and "AAAA-M" are converted, YYYY-MM and empty stay. Anything else
  is not guessed at: the migration fails naming each vaccine and its value, and
  changes nothing. The deploy runs `migrate` before it swaps the release, so
  the running release keeps serving while those few are put right by hand. The
  path is drawn in [`docs/flows/lot-expiry-migration.md`](../flows/lot-expiry-migration.md).
- **"MM/AAAA" is presentation only.** The card and the record's details show
  YYYY-MM as "09/2027"; no client sends or parses that form as data.

## Consequences

- No client has to interpret free text in this field any more, and a value
  outside the contract has nowhere to live.
- A web client can use the browser's month picker, whose value is YYYY-MM.
- A model reading that returns another form loses that field: it has to be
  dropped to empty and unread on the way in rather than stored.
