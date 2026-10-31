# 0004. Every notice goes out on every channel the person has

- Status: accepted
- Date: 2026-10-31

## Context

A reminder nobody sees is a missed vaccine. Push is easy to miss or to have
switched off; e-mail is slow to be read. The native app can receive Expo
pushes; the web app can receive web pushes, which on an iPhone only work with
the site installed on the Home Screen (iOS 16.4 and later, `display:
standalone`, permission asked in response to a tap).

## Decision

- A job runs once a day (`send_reminders`, from the crontab) and sends, for
  each open reminder that reached a milestone, a notice to **every tutor** of
  the animal (never a guest, never for an archived animal).
- Milestones: 7 days before, on the day, and every 7 days while overdue. A run
  sends the latest milestone reached, so a day the job missed is caught up by
  the next run.
- **Every channel, always**: e-mail, an Expo push to each of the person's
  phones (`exponent-server-sdk`), and a web push to each of their browsers
  (`pywebpush` with VAPID). E-mail is not a fallback; it always goes.
- **Once each**: a sending log keyed by (reminder, milestone, person, channel)
  keeps a second run on the same day from sending anything again. A channel
  that fails is not logged, so the next run tries it again.
- The notices of one animal reached on the same day go out as one message per
  person and channel.
- A push destination the provider calls gone (`DeviceNotRegistered` from Expo,
  404 or 410 from a push service) is deleted.

## Consequences

- A tutor with the app on two phones and the site installed in a browser gets
  four notices for one milestone: one e-mail and three pushes.
- The web is a PWA (manifest with `display: standalone`, a service worker that
  shows the push and opens the animal).
