# Pets: the native app

React Native with Expo (SDK 57) and Expo Router, over the API in `backend/` and
the shared package `packages/core` (`@pets/core`: the generated API client, the
identity client, the domain rules of the screens, the strings and the theme).
On-screen text is pt-BR and comes from `@pets/core/strings`.

- Bundle id (iOS) and package (Android): **`com.ampulla.pets`**. TestFlight,
  Play Console and the push tokens are tied to it: it does not change.
- URL scheme: `pets://`. An invite opens at `pets://convite/<token>`, and the web
  link `https://pets.ampulla.tech/convite/<token>` opens the app when it is
  installed (associated domains / Android app links).
- The session token (allauth's, ADR-0002) is kept in the Keychain / Keystore
  through `expo-secure-store` and sent as `X-Session-Token`.

## Layout

```
mobile/
  app.json, app.config.js   static config; app.config.js adds the EAS project id from the environment
  eas.json                  build profiles (the production API base lives here; no secrets)
  src/app/                  the screens, one file per route (Expo Router)
  src/components/           the screens' pieces; src/components/ui/ the primitives (NativeWind)
  src/lib/                  session, identity, push, uploads, pickers, sharing, dates
  src/__tests__/            screen-level tests (jest-expo + Testing Library) over a fake API
```

## Running it locally

Prerequisites: Node 22+, pnpm, Xcode (for iOS) or Android Studio (for Android),
and the backend stack running (`docker compose up` at the repository root,
API at `http://localhost:8300`). Demo data:
`docker compose exec -T pets python manage.py seed_demo` creates
`demo@example.com` / `pets-demo-2026`.

```sh
pnpm install                         # at the repository root
cd mobile
npx expo prebuild                    # generates ios/ and android/ (gitignored)
npx expo run:ios                     # builds, installs on the simulator, starts Metro
npx expo run:android                 # the same on an emulator
```

The app reads its API base from `EXPO_PUBLIC_API_URL`, default
`http://localhost:8300`, which the iOS simulator reaches on the host. The
Android emulator reaches the host at `10.0.2.2`:

```sh
EXPO_PUBLIC_API_URL=http://10.0.2.2:8300 npx expo run:android
```

### On a phone on the same network

A phone does not see the computer's `localhost`. Find the computer's LAN
address (`ipconfig getifaddr en0` on a Mac), start the stack with it so the
backend accepts that host, and point the app at it:

```sh
HOST_IP=192.168.1.27 docker compose up          # at the repository root
cd mobile
EXPO_PUBLIC_API_URL=http://192.168.1.27:8300 npx expo run:ios --device
```

Photos and PDFs open through signed links the API builds from the address the
app called, so the phone must reach that same address.

### Checks

```sh
pnpm --filter pets-mobile typecheck
pnpm --filter pets-mobile test
```

## Push notifications

The app asks for permission when the person taps "Ativar notificações" on the
home, then gets this phone's Expo push token and registers it with
`POST /push/expo`; signing out removes it (`POST /push/expo/remove`). A tapped
notice opens the animal at the reminder's subject, also from a cold start.

An Expo push token needs the **EAS project id**. It is read from the
environment at build time (`EAS_PROJECT_ID` or `EXPO_PUBLIC_EAS_PROJECT_ID`,
put into `extra.eas.projectId` by `app.config.js`). Without it the app builds
and runs normally and simply skips the registration; reminders still go out
by e-mail. Real pushes only arrive on a build signed with the push
credentials below, on a physical device.

## Producing a build and sending it to testers

Builds are made with EAS (Expo Application Services). Everything secret lives
in the maintainer's Apple, Google and Expo accounts, never in this repository.

### What the maintainer creates once

1. **Expo account and EAS project.** `npm i -g eas-cli`, `eas login`, then from
   `mobile/`: `eas init`. This creates the project and prints its id. Keep the
   id out of the repository: set it as an EAS environment variable
   (`eas env:create --name EAS_PROJECT_ID --value <id> --environment production`)
   and export it locally when building (`export EAS_PROJECT_ID=<id>`).
2. **Apple.** A paid Apple Developer Program membership, and in App Store
   Connect a new app with bundle id `com.ampulla.pets`. The Associated Domains
   and Push Notifications capabilities are enabled on that App ID (EAS does it
   when it manages the credentials).
3. **APNs key (iOS push).** In the Apple Developer portal, Keys → create a key
   with Apple Push Notifications service; or let `eas credentials` create and
   upload it. Expo's push service uses it to reach iPhones.
4. **Google.** A Google Play Console developer account and a new app with
   package `com.ampulla.pets`.
5. **FCM (Android push).** A Firebase project with an Android app for
   `com.ampulla.pets`; upload its FCM V1 service account key to EAS
   (`eas credentials` → Android → Google Service Account → FCM V1). The
   `google-services.json` that goes with it is given to the build through an
   EAS file environment variable, not committed.
6. **Store submission keys.** For `eas submit`: an App Store Connect API key
   (Users and Access → Integrations) and a Google Play service account JSON
   with release permission. Both are uploaded to EAS with `eas credentials`
   or given at the prompt.
7. **Universal / app links.** For `https://pets.ampulla.tech/convite/...` to open
   the app, the web host serves `/.well-known/apple-app-site-association` (with
   the Team ID and `com.ampulla.pets`) and `/.well-known/assetlinks.json` (with
   the release signing certificate's SHA-256).

### Building

The `production` profile in `eas.json` sets
`EXPO_PUBLIC_API_URL=https://api.pets.ampulla.tech` and increments the build
number on each build.

```sh
cd mobile
eas build --profile production --platform ios
eas build --profile production --platform android
```

The first iOS build asks to sign in to the Apple account and offers to create
the distribution certificate and the provisioning profile; let EAS manage them.

### Sending to testers

```sh
eas submit --profile production --platform ios       # uploads to App Store Connect → TestFlight
eas submit --profile production --platform android   # uploads to Play Console, internal testing track
```

- **iOS:** once processed in App Store Connect, add the build to a TestFlight
  group (internal testers need no review; external testers need Beta App
  Review) and invite testers by e-mail.
- **Android:** in Play Console, Testing → Internal testing, add the testers'
  e-mails to the list and share the opt-in link. The first upload of a new app
  may have to be done by hand in the console before `eas submit` can publish
  to the track.

For a quick build to install by link without the stores, the `preview` profile
makes an internal-distribution build (`eas build --profile preview`); iPhones
must be registered with `eas device:create` first.
