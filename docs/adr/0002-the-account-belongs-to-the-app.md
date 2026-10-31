# 0002. The account belongs to the app

- Status: accepted
- Date: 2026-10-31

## Context

A person needs an account to keep their animals and to share them. The app
could lean on an identity shared with other apps, or own its accounts. Its data
(animals, vets' names, a microchip) has nothing to do with any other app.

## Decision

The backend owns the identity: **allauth headless**, e-mail and password, no
username, no social sign-in. No account, session or datum crosses to another
app.

- Both clients use allauth's **"app" client**: sign-up and sign-in answer a
  session token, which the client keeps (the Keychain on the phone,
  `localStorage` on the web) and sends as `X-Session-Token` on every call. The
  API authenticates with allauth's own `XSessionTokenAuth`, so the session the
  identity created is the one the API reads, with nothing minted in between.
- **Password reset is by code**: a short code e-mailed to the person and typed
  into the app, which works the same on a phone with no link to open.
- E-mail verification is off: the account is usable right after sign-up.

## Consequences

- Someone who uses another app of the same maker creates a separate account
  here.
- The web keeps a bearer-like token in `localStorage`, readable by a script on
  the page. The web app loads no third-party script, and the token is revoked
  by signing out.
- A typo in the e-mail at sign-up is not caught; the reset code goes to the
  address typed.

## Rejected

- **A shared identity across apps.** The data here is personal and has no
  reason to sit behind someone else's account.
- **allauth's "browser" client (session cookie and CSRF) for the web.** The API
  and the web app live on different hosts, so the cookie and the CSRF token
  would have to be shared across subdomains; one transport for both clients is
  simpler and has one test surface.
