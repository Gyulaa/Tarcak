# Állapot

Frissítve: 2026-10-28. Egy oldal: a `/agentic-code:save-work` írja újra, a `/agentic-code:resume-work` olvassa először.

## Mi ez
Helyi, titkosított személyes pénzügyi app (Expo / React Native). Verzió: 1.3.0 (Android versionCode: az EAS `production` build emeli), az 1.2.3 óta sok változás (SDK 55, havi export, képernyőkép-tiltás, jelszócsere, stílus/UX-kör).

## Most
- A `main`-en van: a teljes átvizsgálás javításai (B1–B21), SDK 55, a havi kimutatás exportja (PR #1–#6).
- A `chore/style-audit` ágon (PR a `main`-re): egy témafüggő diagrampaletta, `DonutChart`, a stíluskapu (`scripts/style-scan.mjs`, a `check.sh` futtatja), hozzáférhetőségi címkék és 48 dp-s célok, szövegek rövidítése, közös `TransactionRow`, a Pockets lista egyenlegekkel, átrendezett tranzakcióűrlap, a Jar és a Settings rendbetétele. Eszközön végigjárva (sötét és világos téma, teszt-vault); döntések: `docs/decisions.md` (2026-10-28, utolsó két bejegyzés).
- Egységtesztek: `npm test` (133 teszt), a `check.sh` futtatja.
- Eszközön még nincs kipróbálva: a History lapozás, a jelszócsere, a képernyőkép-tiltás, az új Android-jogosultságok (`prebuild` nélküli dev buildben a `blockedPermissions` nincs benne), a havi export 6. feladata. iOS-ről semmi nincs ellenőrizve.

## Ágak
- `chore/style-audit`: PR nyitva a `main`-re; a merge Gyula döntése.
- `main`: a PR #1–#6 merge-elve. Régi ágak törölve (helyben és az originen).

## Dev build a telefonra (Linux)
- JDK 17: `~/.jdks/temurin-17` (`JAVA_HOME`), Android SDK: `~/Android/Sdk`, adb: `~/Android/Sdk/platform-tools/adb`.
- `npx expo prebuild --platform android --no-install`, majd `android/gradlew assembleDebug -PreactNativeArchitectures=arm64-v8a` (~22 perc hidegen). Az éles Tarcak más aláírású, ezért a debug build `android/app/build.gradle`-ban `applicationIdSuffix ".dev"`-et kap (az `android/` ignorált, kézzel kell). Utána `adb reverse tcp:8081 tcp:8081` és `npx expo start --localhost`.
- Natív modul hozzáadása után elég az `android/`-ban `./gradlew assembleDebug -PreactNativeArchitectures=arm64-v8a` (prebuild nélkül, ~1 perc cache-sel), majd `adb install -r android/app/build/outputs/apk/debug/app-debug.apk`. JS-változásnál csak Metro kell: a telefon az `adb reverse` után a `localhost:8081`-ről tölt, a képernyők `adb exec-out screencap -p`-vel nézhetők (teszt-vaulttal, valódi adat nélkül).

## Blokkol / várunk
- Az 1.3.0 `production` (AAB) build az EAS-en fut vagy kész; a versionCode-emelést az `app.json`-ba vissza kell commitolni (`docs/ANDROID_GITHUB_RELEASE.md`).

## Következő lépés
1. **Tétel nevének automatikus kiegészítése:** a tranzakcióűrlap Title mezőjében gépelés közben ajánljon korábbi tételneveket (kezdőbetűk alapján, a már használtak közül), egy koppintással kitöltve a nevet; érdemes a kategóriát és a zsebet is felajánlani az utolsó ilyen nevű tételből. A `spec` skill szerint kezdd tervvel (adatforrás: a `transactions.title` különböző értékei, gyakoriság/utolsó használat szerint; nincs új függőség, nincs hálózat; a javaslatlista az eszközön marad, egyetlen helyen sem naplózódik).
2. A PR #7 merge-e; az 1.3.0 AAB feltöltése a Play Console-ba (a build az EAS-en: expo.dev → Builds).
3. Havi export: a 6. feladat (eszközön, teszt-vaulttal); hibák a `docs/bugs.md`-be. A README 5. sora kiegészítést kérhet az exportról.
4. B22 (alacsony): a History szűrőchipjén a „×” iOS VoiceOverrel nem érhető el.
5. README „Still to add”: szerkeszthető `occurred_at`, zseb átnevezés UX. Ha kell: a statisztika idősora és kategóriaösszegei is `bigint` (B11).

## Súrlódás
- A pre-commit check a teljes munkafát típusellenőrzi, nem csak a stage-elt fájlokat: fájlonkénti `@ts-nocheck`-kivezetésnél a többi fájlba vissza kellett tenni a direktívát (egyszer, kb. 2 perc).
- Az egymásra épülő (stacked) PR-ok a saját alap-águkba olvadtak, nem a `main`-be (egyszer, a #5 hozta rendbe). Legközelebb minden PR a `main`-re menjen.
- A telefonon lévő dev build elavult volt (hiányzott a `ExpoScreenCapture`), ezért az app nem töltött be (egyszer, kb. 15 perc). Új natív függőség után azonnal új dev build.
- A diagramok és képernyők a képernyőképek nélkül (kód alapján) átvizsgálva is hibásan jelentek meg: a 12 px-es x-tengely-felirat törése csak a telefonon derült ki. Vizuális változás után azonnal eszközön kell nézni (egyszer, kb. 10 perc).
