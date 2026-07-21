# TopTech Instructor Mobile

The Expo/React Native application used by TopTech instructors to authenticate,
view assigned students, and interact with the TopTech Student Progress API.

## Architecture

The app uses the same Firebase project and backend as the admin platform. It
never connects directly to PostgreSQL:

```text
Mobile app -> Firebase Authentication -> Firebase ID token
Mobile app -> TopTech API /api/mobile/* -> Prisma -> PostgreSQL
```

The backend, database schema, and admin application live in the companion
`toptech-student-progress` repository.

## Requirements

- Node.js 22.13 or newer
- pnpm 10
- Android Studio or a physical Android device
- Access to the TopTech Firebase Android app configuration

## Setup

```bash
corepack enable
pnpm install
cp .env.example .env.local
```

For Android Firebase authentication, place the environment-specific
`google-services.json` file in the repository root. It is intentionally ignored
by Git and must not contain Firebase Admin or database credentials.

Set `EXPO_PUBLIC_API_URL` in `.env.local` to either the deployed API or your
development machine's LAN address. A physical device cannot reach a backend at
the computer's `localhost` address.

## Development

This application uses React Native Firebase native modules and therefore needs
an Expo development build; Expo Go is not sufficient.

```bash
pnpm typecheck
pnpm android
```

Build profiles are defined in `eas.json`. See `docs/android-dependencies.md`
for Firebase and Android setup details.

## Configuration safety

Only public client configuration may use the `EXPO_PUBLIC_` prefix. Never put
database URLs, service-account JSON, private keys, Firebase Admin credentials,
or PostgreSQL passwords in this repository or in the mobile bundle.
