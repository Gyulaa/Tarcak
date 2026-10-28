# Állapot

Frissítve: 2026-10-28. Egy oldal: a `/agentic-code:save-work` írja újra, a `/agentic-code:resume-work` olvassa először.

## Mi ez
Helyi, titkosított személyes pénzügyi app (Expo / React Native). Verzió: 1.2.3 (Android versionCode 5).

## Most
- 2026-10-27: teljes átvizsgálás (B4–B21 a `docs/bugs.md`-ben), a `@ts-nocheck` kivezetése (B3) és 13 hiba javítása, plusz a kiírt összegek kerekítése (auto + eszközönként, migráció 0008). Döntések: `docs/decisions.md` (2026-10-27).
- 2026-10-28: B12 kész: `npm audit fix`, Expo SDK 55 (RN 0.83), `zod` override, `expo-system-ui`. A Security scan kapu lokálisan zöld (8 alacsony súlyú marad). Eszközteszt a telefonon (SDK 55 dev build) sikeres, Gyula szerint minden jól működik.
- Egységtesztek: `npm test` (Node beépített futtató, 28 teszt), a `check.sh` futtatja.

## Nyitott ágak és PR-ok (egymásra épülnek, a PR-ok nyitva, merge sorrendben)
1. `chore/claude-setup` (main-ről): Claude-beállítás.
2. `fix/ts-nocheck` (az 1-re): B3 + az átvizsgálás hibanaplója.
3. `fix/review-findings` (a 2-re): javítások B4–B21-ből + kerekítés.
4. `chore/dependency-updates` (a 3-ra): B12, Expo SDK 55.

## Dev build a telefonra (Linux)
- JDK 17: `~/.jdks/temurin-17` (`JAVA_HOME`), Android SDK: `~/Android/Sdk`, adb: `~/Android/Sdk/platform-tools/adb`.
- `npx expo prebuild --platform android --no-install`, majd `android/gradlew assembleDebug -PreactNativeArchitectures=arm64-v8a` (~22 perc hidegen). Az éles Tarcak más aláírású, ezért a debug build `android/app/build.gradle`-ban `applicationIdSuffix ".dev"`-et kap (az `android/` ignorált, kézzel kell). Utána `adb reverse tcp:8081 tcp:8081` és `npx expo start --localhost`.

## Blokkol / várunk
- Gyula döntése: B10 Android-része (`expo-screen-capture`, új függőség).

## Következő lépés
1. A PR-ok átnézése és merge sorrendben (1 → 4).
2. Nyitott hibák: B11 maradék (2^53 fölötti egyenlegösszegek), B15 (History szűrés SQL-ben, lapozás), B19 (jelszócsere felület), B2 (kontraszt), B10/B16/B20/B21 maradék része.
3. README „Still to add”: szerkeszthető `occurred_at`, zseb átnevezés UX.

## Súrlódás
- A pre-commit check a teljes munkafát típusellenőrzi, nem csak a stage-elt fájlokat: fájlonkénti `@ts-nocheck`-kivezetésnél a többi fájlba vissza kellett tenni a direktívát (egyszer, kb. 2 perc).
