# 0002. The account belongs to the app

- Status: accepted
- Date: 2026-11-01

## Context

A person needs an account to keep their animals and to share them. The app
could lean on an identity shared with other apps, or own its accounts. Its data
(animals, vets' names, a microchip) has nothing to do with any other app.

The account is reached from two clients: the web app, served at
`pets.ampulla.tech` while the API answers at `api.pets.ampulla.tech` (locally
`localhost:5180` and `localhost:8300`, or the machine's LAN address on both
ports from a phone), and the native app, which has no cookie jar of its own to
rely on.

## Decision

The backend owns the identity: **allauth headless**, e-mail and password, no
username, no social sign-in. No account, session or datum crosses to another
app.

- **The web uses allauth's "browser" client**: the session is allauth's
  session cookie, which no script on the page reads. Every call to the API is
  made with credentials, and every write sends the CSRF cookie back as
  `X-CSRFToken`. The web keeps only the account's e-mail in `localStorage`, to
  render its first screen at once, and checks it against the server's session
  at start.
- **The native app uses allauth's "app" client**: sign-in answers a session
  token, kept in the Keychain / Keystore and sent as `X-Session-Token` on every
  call.
- The API accepts either (`accounts/auth.py`): the token through allauth's own
  `XSessionTokenAuth`, or the cookie through the Django session allauth
  created, with Django's CSRF check on every unsafe call. A call that names a
  token is judged by the token alone, so a dead token answers 401, never a
  CSRF 403.
- **The cookies cross from the web app's host to the API's because both are
  the same site.** A port does not make another site, and `pets.ampulla.tech`
  is a parent of `api.pets.ampulla.tech`, so `SameSite=Lax` cookies travel
  with the calls. In production the session and CSRF cookies are set for the
  domain `pets.ampulla.tech` (`SESSION_COOKIE_DOMAIN`, `CSRF_COOKIE_DOMAIN`),
  `Secure`, so the web app can read the CSRF one; locally they stay host-only,
  which already covers both ports of `localhost` or of the LAN address. CORS
  allows credentials for the web app's origins only, and the same origins are
  `CSRF_TRUSTED_ORIGINS`.
- **The e-mail is confirmed at sign-up, by code.** Verification is mandatory:
  sign-up e-mails an `XXXX-XXXX` code, valid for 15 minutes, and the account is
  usable only once the code is typed into the app. A code works the same on
  the web and on a phone that has no link to open, where a link would land in
  the browser instead of the app. Signing in to an account not yet confirmed
  sends a fresh code; the code screen can ask for another.
- **Password reset is by code** too, for the same reason.
- **Accepting an invite does not confirm the e-mail.** An invite would count
  as proof only if it had been sent to that address, and it never is: it is a
  link the tutor hands over by any channel (ADR-0006), addressed to no one. So
  someone who opens an invite without an account signs up, types the e-mailed
  code like anyone else, and comes back to the invite to accept it.
- Locally, every e-mail goes to Mailpit, in the compose stack, and is read in
  its web UI; production sends through Resend.

## Consequences

- Someone who uses another app of the same maker creates a separate account
  here.
- A typo in the e-mail at sign-up is caught: the code never arrives, and the
  account stays unusable.
- The web's writes depend on the CSRF cookie being readable by the web app's
  host. Moving the web app or the API to names that are not the same site
  breaks the web's session, and changing either name means changing the cookie
  domain with it.
- Two transports means two test surfaces: the backend tests sign up both ways.

## Rejected

- **A shared identity across apps.** The data here is personal and has no
  reason to sit behind someone else's account.
- **The "app" client and its token for the web too.** One transport for both
  clients is simpler, but the web would keep a bearer token in `localStorage`,
  readable by any script that ever runs on the page.
- **Confirming by link.** On a phone the link opens the browser, not the app,
  and the person who signed up in the app would finish in the wrong place.
- **Counting an accepted invite as a confirmed e-mail.** The invite is sent to
  no address, so it proves nothing about the one typed at sign-up.
