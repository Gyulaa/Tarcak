# Állapot

Frissítve: 2026-10-28. Egy oldal: a `/agentic-code:save-work` írja újra, a `/agentic-code:resume-work` olvassa először.

## Mi ez
Helyi, titkosított személyes pénzügyi app (Expo / React Native). Verzió: 1.2.3 (Android versionCode 5).

## Most
- 2026-10-27: teljes átvizsgálás (B4–B21 a `docs/bugs.md`-ben), `@ts-nocheck` kivezetése (B3), 13 hiba javítása, kiírt összegek kerekítése (migráció 0008).
- 2026-10-28: B12 (Expo SDK 55, audit kapu). Utána a maradék hibák: B15 (History szűrés/lapozás SQL-ben), B19 (jelszócsere), B2 (kontraszt, `tests/colorContrast.test.ts`), B16 (jogosultságok), B21 (cache-takarítás), B11 (egyenlegek `bigint`), B10 (kapcsolható „Block screenshots”, új függőség `expo-screen-capture`). Minden a `main`-en (PR #5 merge-elve), nincs nyitott hiba (B20 maradéka szándékos). Döntések: `docs/decisions.md`.
- Eszközön még nincs kipróbálva: a History lapozás, a jelszócsere, az új palettaszínek, a képernyőkép-tiltás, az új Android-jogosultságok (a 2026-10-28 09:09-es dev build már tartalmazza az `expo-screen-capture`-t, de `prebuild` nélkül készült, így a `blockedPermissions` nincs benne). iOS-ről semmi nincs ellenőrizve.
- 2026-10-28: havi kimutatás exportja (Statisztika → „Export report…”, sima CSV, nincs vágólap/titkosítás): spec `docs/specs/2026-10-28-monthly-report-export.md`, az 1–5. feladat kész és a független review (4 kisebb észrevétel) javítva a `feat/monthly-report-export` ágon; az export alapból International CSV (pont tizedesjel; eszközön a vessző ezres tagolónak olvasódott). A 6. (eszközön ellenőrzés teszt-vaulttal) Gyulára vár. Ugyanezen az ágon van a „Restored from backup” banner rendbetétele (külön commit).
- Egységtesztek: `npm test` (Node beépített futtató, 91 teszt), a `check.sh` futtatja.

## Ágak
- `feat/monthly-report-export` (az `origin/main`-ről, pusholva, PR nyitva a `main`-re): a havi kimutatás exportja, feladatonként külön commit, plusz a banner-javítás (`671596e`, külön témájú, kérésre szétszedhető).
- `main` naprakész, a PR #1–#5 mind merge-elve. A régi ágak (`chore/claude-setup`, `fix/ts-nocheck`, `fix/review-findings`, `chore/dependency-updates`, `fix/remaining-bugs`) törölhetők (helyben és az originen is; remote törlés csak engedéllyel).

## Dev build a telefonra (Linux)
- JDK 17: `~/.jdks/temurin-17` (`JAVA_HOME`), Android SDK: `~/Android/Sdk`, adb: `~/Android/Sdk/platform-tools/adb`.
- `npx expo prebuild --platform android --no-install`, majd `android/gradlew assembleDebug -PreactNativeArchitectures=arm64-v8a` (~22 perc hidegen). Az éles Tarcak más aláírású, ezért a debug build `android/app/build.gradle`-ban `applicationIdSuffix ".dev"`-et kap (az `android/` ignorált, kézzel kell). Utána `adb reverse tcp:8081 tcp:8081` és `npx expo start --localhost`.

Natív modul hozzáadása után elég az `android/`-ban `./gradlew assembleDebug -PreactNativeArchitectures=arm64-v8a` (prebuild nélkül, ~1 perc cache-sel; a prebuild felülírná a kézi `.dev` utótagot), majd `adb install -r android/app/build/outputs/apk/debug/app-debug.apk`. A Metro leáll a munkamenettel; indítás előtt `adb reverse tcp:8081 tcp:8081`.

## Blokkol / várunk
- A havi export 6. feladata: eszközön ellenőrzés teszt-vaulttal (a spec „Ellenőrzés” szakasza szerint; a tranzakciószerkesztő mindig `Date.now()`-t ad, ezért a hónaphatár-tranzakcióhoz az eszköz óráját kell átállítani); a PR merge-e Gyula döntése.

## Következő lépés
1. Havi export: a 6. feladat (eszközön, teszt-vaulttal), hibák a `docs/bugs.md`-be. A README 5. sora („All data stays on the device…”) kiegészítést kérhet az exportról (privacy-check javaslat, a spec végén).
2. Új dev build a telefonra és a fenti, még ki nem próbált részek átnézése; ha jó, kiadás (verzió- és versionCode-emelés külön commitban, EAS csak engedéllyel).
3. README „Still to add”: szerkeszthető `occurred_at`, zseb átnevezés UX.
4. Ha kell: a statisztika idősora és kategóriaösszegei is `bigint` (most diagramértékként `number`, 2^53 fölött kerekített; `docs/bugs.md` B11).

## Súrlódás
- A pre-commit check a teljes munkafát típusellenőrzi, nem csak a stage-elt fájlokat: fájlonkénti `@ts-nocheck`-kivezetésnél a többi fájlba vissza kellett tenni a direktívát (egyszer, kb. 2 perc).
- Az egymásra épülő (stacked) PR-ok a saját alap-águkba olvadtak, nem a `main`-be, így a munka napokig nem került be (egyszer, a #5 hozta rendbe). Legközelebb minden PR a `main`-re menjen, vagy a stack alját merge-eljük először.
- A telefonon lévő dev build elavult volt (hiányzott a `ExpoScreenCapture` natív modul), ezért az app nem töltött be, és három kört vitt a kiderítése (egyszer, kb. 15 perc). Legközelebb új natív függőség után azonnal új dev build.
