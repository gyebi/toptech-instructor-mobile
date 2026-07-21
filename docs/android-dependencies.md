# Android Instructor App Dependencies

Updated: 20 July 2026

The Android instructor app lives in this repository and targets Expo SDK 57, React Native 0.86, React 19.2, Android SDK 36, and Node.js 22.13 or newer.

## Installed workspace foundation

- `expo ~57.0.7`
- `react-native 0.86.0`
- `react 19.2.3`
- TypeScript 6

## Native packages required

Install these with Expo-compatible versions:

```bash
corepack pnpm add \
  expo-dev-client@~57.0.7 \
  expo-secure-store@~57.0.1 \
  @react-native-firebase/app \
  @react-native-firebase/auth
```

Purpose:

- `expo-dev-client`: required because React Native Firebase contains native code and does not run in Expo Go.
- `@react-native-firebase/app`: native Firebase application configuration.
- `@react-native-firebase/auth`: Android phone-number and OTP authentication.
- `expo-secure-store`: protected storage for minimal local application state; do not manually store raw Firebase ID tokens.

## Files you must provide

### `google-services.json`

Create/register an Android app in the Firebase project and download its configuration file to:

```text
google-services.json
```

This file is environment-specific and must not be committed. The mobile `.gitignore` must contain:

```gitignore
google-services.json
```

The Android application ID proposed for this project is:

```text
com.toptechghana.instructor
```

Confirm that application ID before registering the Android app because changing it later creates a different Firebase Android application.

## Firebase Console configuration

In the same Firebase project used by the API:

1. Open **Authentication → Sign-in method**.
2. Enable the **Phone** provider.
3. Register the Android application ID.
4. Add the Android debug and release **SHA-1** and **SHA-256** certificate fingerprints.
5. Download a fresh `google-services.json` after registering the fingerprints.
6. Configure Firebase test phone numbers and fixed OTP codes for development; do not send real SMS messages in automated tests.

Android phone authentication uses Play Integrity when available and can fall back to reCAPTCHA. Test on a physical Android device or an emulator with Google Play services.

## Local development tools

- Node.js 22.13 or newer
- pnpm 10 through Corepack
- Java Development Kit supported by the installed Android Gradle Plugin
- Android Studio
- Android SDK Platform 36
- Android SDK Build Tools
- Android emulator with Google Play services, or a physical Android device
- USB debugging for physical-device development

React Native Firebase requires an Expo development build. Expo Go is not sufficient.

## Mobile environment variables

Only public, non-secret configuration may use the `EXPO_PUBLIC_` prefix:

```dotenv
EXPO_PUBLIC_API_URL=http://YOUR_DEVELOPMENT_MACHINE_LAN_IP:4000
```

For production builds:

```dotenv
EXPO_PUBLIC_API_URL=https://toptech-900622238331.us-east4.run.app
```

Do not put service-account JSON, database URLs, private keys, PostgreSQL passwords, or Firebase Admin credentials in the mobile app.

An Android emulator normally reaches the host machine through `10.0.2.2`, while a physical device needs the development machine's LAN address. The API must listen on an address reachable from that device during local testing.

## Native configuration

The Expo application configuration must include:

```json
{
  "expo": {
    "android": {
      "package": "com.toptechghana.instructor",
      "googleServicesFile": "./google-services.json"
    },
    "plugins": [
      "@react-native-firebase/app",
      "@react-native-firebase/auth",
      "expo-secure-store"
    ]
  }
}
```

Do not run `expo prebuild --clean` until `google-services.json` is present. That command regenerates native directories.

## Backend requirements

The Express API must remain the authorization authority. It must:

- Verify every Firebase ID token.
- Use the verified token's `phone_number` claim, never a client-submitted phone number.
- Match the normalized number to an existing `INSTRUCTOR` user.
- Require both the user account and instructor employment status to be active.
- Link the Firebase UID transactionally on first login.
- Return only students with a currently active `InstructorAssignment` for that instructor.
- Recheck database authorization on every protected request even when custom claims are present.

## Remaining external inputs

- Confirm the Android application ID `com.toptechghana.instructor`.
- Provide `google-services.json` in the repository root.
- Enable Firebase Phone authentication.
- Add Android SHA-1 and SHA-256 fingerprints.
- Add at least one Firebase test phone number and test OTP for development.
- Confirm whether local mobile testing will use an emulator or a physical Android device so `EXPO_PUBLIC_API_URL` can be set correctly.
