# 0001. One repository for the API, the web app and the native app, with the shared logic generated from the contract

- Status: accepted
- Date: 2026-10-31

## Context

The app has two first-class clients from its first version, the native app
(iOS and Android) and the web app, over one API. Two clients written by hand
against one API drift: two clients of the API, two sets of types, two copies of
the same rules (an animal's age, a badge's text), and nothing that fails when
the backend changes under them.

## Decision

One repository, four parts, one pnpm workspace for the JavaScript ones:

- **`backend/`**: Django 6 and Django Ninja. It owns the data, the rules, the
  identity (ADR-0002) and the scheduled jobs.
- **`web/`**: Vite, React, TypeScript, Tailwind v4, shadcn/ui copied into the
  repository by its CLI (code of this repository, edited where used), TanStack
  Query, react-hook-form with zod. Installable as a PWA.
- **`mobile/`**: React Native with Expo and Expo Router.
- **`packages/core`** (`@pets/core`): what both clients share, with no DOM, no
  React Native and no component.
  - **The API client is generated** by `@hey-api/openapi-ts` from the OpenAPI
    document django-ninja exports (`packages/core/scripts/openapi.sh`): types,
    zod schemas, the SDK and the TanStack Query options, over a fetch client
    each app configures at start-up. The output is committed, and CI
    regenerates it from the backend and fails on any difference. Operation ids
    are the view functions' names, so the generated names are stable.
  - **The identity client is written by hand**: allauth's headless flows sit
    outside the ninja document.
  - **The domain as the screens say it** (ages, dates, badges, labels), the
    **strings** (pt-BR) and the **theme**, whose source generates the web theme
    (the variables shadcn/ui reads) and the same values in hex for the native
    app.

Each part has its own path-filtered CI workflow, so a change on one side never
blocks the other.

## Consequences

- A backend change that alters the contract must regenerate the client in the
  same change, or CI fails.
- The web and the native app share logic, not components: each has its own
  primitives on its own platform.

## Rejected

- **The web build of the Expo app.** One codebase for both clients, but the web
  would inherit React Native's layout model and lose shadcn/ui.
- **A hand-written client per app.** It is the arrangement that drifts.
