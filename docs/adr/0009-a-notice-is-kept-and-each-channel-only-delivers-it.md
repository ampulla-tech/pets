# 0009. A notice is kept, and each channel only delivers it

- Status: accepted
- Date: 2026-11-06

## Context

Until now a notice existed only while it was being sent: the daily job built
the words anew for each channel, and the sending log (`Delivery`) kept only
(reminder, milestone, person, channel). There was nothing the app could list,
nowhere to keep whether the person had read it, and the e-mail and the pushes
could say slightly different things. The words were also a list of diseases
("Cinomose, Hepatite infecciosa, ... vence hoje") that does not tell a tutor
what to do.

## Decision

- **A notice (`Notice`) is a stored thing**: what the app told one tutor about
  one animal on one day, with a title, a second line, a link to the animal and
  when it was read (`read_at`, empty until then). It is written once, by the
  daily job, and its words never change afterwards.
- **Its items (`NoticeItem`)** are the (reminder, milestone) pairs it covers,
  unique per person. That is what keeps a milestone from becoming a second
  notice, and what makes the job safe to run twice in a day.
- **A delivery (`Delivery`) is (notice, channel)**, unique. E-mail, the Expo push
  and the web push all send the same title and second line; the pushes carry
  the notice id, so opening the app from one marks that notice read.
- **A channel that failed is not logged** and the next run delivers the same
  notice again, for one day: after that its words ("Hoje é dia de...") would be
  stale, and the notice stays in the app's list. A channel with no destination
  (no phone, no browser) is not a failure and is not logged either.
- **The words come from one function** (`reminders/wording.py`): the title says
  what to do and with whom ("Hoje é dia de vacinar a Paçoca."), the second line
  names the product of the dose ("Vanguard Plus"). The reminders a dose opened
  for several diseases are one vaccine. The stage is said from the day the
  notice is written, so a notice the job caught up late says it is late. When
  the doses are due on different days, the most urgent is the title and the
  others' sentences are the second line.
- **The change of model sends nothing again**: every (reminder, milestone,
  person) the old sending log had becomes an item with no notice. No notice is
  rebuilt from the old log, so the app's list starts empty.

## Consequences

- The app's list, the push and the e-mail say the same thing by construction.
- The read state lives on the server, so it holds across the web and the
  native app.
- ADR-0004 still holds: every channel, always, e-mail included. What changes is
  that the channels deliver a notice instead of composing one.
- The run is drawn in [`docs/flows/notice.md`](../flows/notice.md).
