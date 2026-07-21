# Mobile App Future Upgrades

Updated: 21 July 2026

This document records features intentionally deferred from the current Android instructor app. None of the features below are included in the current release.

## Biometric unlock

### Status

Deferred to a future upgrade. The current app uses Firebase phone-number and OTP authentication without a biometric gate.

### Intended behaviour

- Offer biometric unlock only after a successful phone-and-OTP login.
- Keep the feature optional and disabled by default.
- Clearly explain that biometric unlock protects access to an existing Firebase session; it does not replace Firebase authentication or backend authorization.
- Require OTP again after explicit logout, a device change, Firebase session revocation, or an administrator disabling the instructor account.
- Continue verifying the Firebase ID token and current database permissions on every protected API request.
- Never store raw Firebase ID tokens manually.

### Proposed implementation

1. Install the Expo SDK-compatible `expo-local-authentication` package.
2. Add its Expo config plugin and rebuild the native Android application.
3. Check that biometric hardware exists and that the user has enrolled a fingerprint or supported face credential.
4. Ask the instructor to opt in after a successful login.
5. Store only the opt-in preference with `expo-secure-store`.
6. Prompt for strong biometrics when reopening an authenticated session.
7. Provide a clear fallback to log out and authenticate again with OTP.

### Security requirements

- Use Android strong biometrics when available.
- Do not treat local biometric success as proof of the instructor role.
- Do not bypass backend account-status or assignment checks.
- Clear the local opt-in preference on logout.
- Recheck the instructor record after biometric unlock before showing protected data.
- Do not show the biometric option on unsupported or unenrolled devices.

### Acceptance criteria

- The instructor can use the app normally without enabling biometrics.
- Enabling the feature requires a successful device biometric prompt.
- Reopening the app prompts before protected data is displayed.
- Cancelling or failing the prompt does not expose instructor or student data.
- Logging out always returns the app to phone-and-OTP authentication.
- Disabling an instructor in the backend blocks access even after local biometric success.
- Android development and production builds contain only the permissions added by the approved biometric library configuration.
