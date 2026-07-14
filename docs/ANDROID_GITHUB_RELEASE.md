# Build an Android APK for GitHub Releases

Tarcak uses **native modules** (SQLCipher, SecureStore). You need a **development or production native build** — not Expo Go. The usual path is **EAS Build** (Expo’s cloud builders).

## Prerequisites

1. **Expo account** — [expo.dev](https://expo.dev) (free tier includes limited EAS builds).
2. **Node.js** and this repo installed (`npm ci`).
3. **`android.package`** — set in `app.json` (`com.gyulaa.tarcak`). Change it if you own a different namespace.

## One-time setup

```bash
npx eas-cli@latest login
npx eas-cli@latest init
```

(Or install `eas-cli` globally once: `npm install -g eas-cli`.)

`eas init` links the project to Expo and may add `extra.eas.projectId` to `app.json`. Commit that change.

## Build an installable APK (good for GitHub)

The **`preview`** profile in `eas.json` sets `android.buildType` to **`apk`** (single file users can sideload). **AAB** (`production` profile) is for Play Store, not ideal as a direct download.

```bash
npx eas-cli@latest build --platform android --profile preview
```

- First run: EAS will ask to create an **Android keystore** (let Expo manage it, or supply your own).
- When the build finishes, open the URL from the CLI or [expo.dev](https://expo.dev) → your project → **Builds** → download **`.apk`**.

## Publish on GitHub

1. In GitHub: **Releases** → **Draft a new release**.
2. Tag (e.g. `v1.0.0`) and release notes.
3. **Attach** the downloaded `.apk` (e.g. `Tarcak-v1.0.0.apk`).
4. Publish.

Tell users they must allow **“Install unknown apps”** for the browser or file manager (Android security).

## Version bumps for later releases

- **`app.json`**: bump `"version"` (shown to users) before each release — this one is not automated.
- **`android.versionCode`**: auto-incremented by EAS (`"autoIncrement": true` on the `preview` and `production` profiles in [`eas.json`](../eas.json)) every time you run `eas build` with either profile. EAS writes the bumped value back into `app.json` — **commit that change** after the build finishes (or before, some workflows prefer running the build once locally-dry to pick up the bump first). You should not need to hand-edit `android.versionCode` anymore.

## Optional: local build (no EAS)

Requires Android SDK + JDK:

```bash
npx expo prebuild --platform android
cd android && ./gradlew assembleRelease
```

APK path is typically `android/app/build/outputs/apk/release/app-release.apk` (you must configure signing in `android/`). EAS is simpler for most people.

## Security note

Signing keys matter: anyone with your **release keystore** can ship updates users trust. Store keystore passwords in a password manager; if using EAS-managed credentials, follow [Expo’s backup docs](https://docs.expo.dev/app-signing/app-credentials/).
