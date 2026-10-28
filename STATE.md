# Állapot

Frissítve: 2026-10-28 (délután). Egy oldal: a `/agentic-code:save-work` írja újra, a `/agentic-code:resume-work` olvassa először.

## Mi ez
Helyi, titkosított személyes pénzügyi app (Expo / React Native). Verzió: 1.2.3 (Android versionCode 5).

## Most
- 2026-10-27: teljes átvizsgálás (B4–B21 a `docs/bugs.md`-ben), a `@ts-nocheck` kivezetése (B3) és 13 hiba javítása, plusz a kiírt összegek kerekítése (auto + eszközönként, migráció 0008). Döntések: `docs/decisions.md` (2026-10-27).
- 2026-10-28: B12 kész: `npm audit fix`, Expo SDK 55 (RN 0.83), `zod` override, `expo-system-ui`. A Security scan kapu lokálisan zöld (8 alacsony súlyú marad). Eszközteszt a telefonon (SDK 55 dev build) sikeres, Gyula szerint minden jól működik.
- Egységtesztek: `npm test` (Node beépített futtató, 57 teszt), a `check.sh` futtatja.

## Ágak
- A #1–#4 PR le van zárva (merge), de a #2–#4 a saját alap-ágába olvadt, nem a `main`-be: a `main`-en csak a #1 (Claude-beállítás) van rajta. Minden más munka a `chore/dependency-updates`-en van (36 commit a `main` előtt).
- `fix/remaining-bugs` (a `chore/dependency-updates`-ről, nincs pusholva): B15, B19, B2, B16, B21, B11 javítva, eszközön még nem kipróbálva (a B15 szűrés, a jelszócsere, a palettaszínek, az új jogosultságok kellenek buildhez).

## Dev build a telefonra (Linux)
- JDK 17: `~/.jdks/temurin-17` (`JAVA_HOME`), Android SDK: `~/Android/Sdk`, adb: `~/Android/Sdk/platform-tools/adb`.
- `npx expo prebuild --platform android --no-install`, majd `android/gradlew assembleDebug -PreactNativeArchitectures=arm64-v8a` (~22 perc hidegen). Az éles Tarcak más aláírású, ezért a debug build `android/app/build.gradle`-ban `applicationIdSuffix ".dev"`-et kap (az `android/` ignorált, kézzel kell). Utána `adb reverse tcp:8081 tcp:8081` és `npx expo start --localhost`.

## Blokkol / várunk
- Gyula döntése: B10 Android-része (`expo-screen-capture`, új függőség).

## Következő lépés
1. A munka `main`-re juttatása: egy új PR a `fix/remaining-bugs`-ból (tartalmazza a #2–#4 munkáját is). Push és PR csak engedéllyel.
2. Nyitott hibák: B10 Android-része (`expo-screen-capture`; Gyula szerint nem kötelező, lásd döntések).
3. README „Still to add”: szerkeszthető `occurred_at`, zseb átnevezés UX.

## Súrlódás
- A pre-commit check a teljes munkafát típusellenőrzi, nem csak a stage-elt fájlokat: fájlonkénti `@ts-nocheck`-kivezetésnél a többi fájlba vissza kellett tenni a direktívát (egyszer, kb. 2 perc).
