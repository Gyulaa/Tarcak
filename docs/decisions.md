# Döntések

Tartós döntésenként egy bejegyzés, a legújabb elöl. Változó döntést helyben szerkesztünk (a változás dátumával), nem duplikálunk. A korábbi döntések háttere a `README.md`-ben van (biztonsági modell, séma).

## 2026-10-27 · Összegbevitel: a vessző és a pont is tizedesjel
- **Döntés:** az összegmezőben a `,` és a `.` egyaránt a tizedeseket jelöli; számjegyet csoportosítani csak szóközzel lehet; két elválasztó („1,000.50”) hiba, nem találgatunk.
- **Miért:** a régi parser minden vesszőt eldobott, így a magyar „12,5” 125 lett (B7). Gyula döntése.
- **Érinti:** `src/utils/amountMinor.ts`, `src/screens/JarAdvancedAssetEditor.tsx`

## 2026-10-27 · A kiírt összegek kerekítenek; eszközönként felülírható
- **Döntés:** listák és összesítők kerekítve mutatják az összeget. Automatikusan: 100 egységtől nincs tizedes, 1 és 100 között 2, 1 alatt 3 értékes jegy. Eszközönként fix 0–8 tizedes állítható (Asset types → Edit; `asset_types.display_decimals`, migráció 0008, NULL = auto). A tárolt érték és a szerkesztőmezők pontosak maradnak.
- **Miért:** a 8 tizedes nagy összegeknél fölösleges (333.33333333 HUF); csak méret alapján viszont a kriptó (1.23456789 BTC) veszítene. Gyula választása az „auto + eszközönként” változat.
- **Érinti:** `src/utils/formatMinor.ts` (memóriabeli tábla, a `listAssetTypes` tölti), `src/screens/AssetTypesScreen.tsx`

## 2026-10-27 · Egységtesztek a Node beépített futtatójával
- **Döntés:** `npm test` = `node --test` a `tests/*.test.ts`-re, függőség nélkül (a Node 24 maga kezeli a típusokat). A `tests/resolve-ts.mjs` a kiterjesztés nélküli importokat `.ts`-re oldja, a natív Expo modulokat (`expo-crypto`) a `tests/stubs/` helyettesíti. A `check.sh` futtatja.
- **Miért:** a tesztfuttató eddig új függőség lett volna; így nem kell.
- **Érinti:** `package.json`, `scripts/check.sh`, `tests/`

## 2026-10-27 · `.tarcak` mentés: v2 külső formátum
- **Döntés:** az új mentések fejlécében benne van a PBKDF2-iterációszám, és a fejléc GCM AAD-ként hitelesített; a v1 fájlok (mindig 100 000 iteráció) továbbra is nyithatók. A régi appverzió a v2-t nem nyitja meg („Update the app”).
- **Miért:** az iterációszám emelése különben minden régi mentést nyithatatlanná tett volna (B6). Gyula kérte a hibák javítását.
- **Érinti:** `src/security/backupCrypto.ts`

## 2026-10-27 · Jar-elosztás: csak pontosan 100%, archivált zseb nem lehet cél
- **Döntés:** az Advanced Jar csak 100%-os splitet ment (a „Save anyway” részleges mentés megszűnt); archivált zseb nem lehet split-cél (archiválás elutasítva, elosztás megáll).
- **Miért:** a részleges split mentése mindig elbukott a repóban és az elosztásban (B13); archivált célba rejtett zsebbe ment volna a pénz (B14).
- **Érinti:** `src/domain/jarAdvancedEditorSave.ts`, `src/db/repositories/pockets.ts`, `src/db/repositories/jar.ts`

## 2026-10-27 · Android: nincs automatikus rendszermentés
- **Döntés:** `app.json` → `android.allowBackup: false`; a támogatott mentés a titkosított `.tarcak` export.
- **Miért:** a Google-mentés a DB-t a SecureStore-kulcsok nélkül vitte volna át, új készüléken nyithatatlan fájl maradt volna (B16).
- **Érinti:** `app.json` (új buildtől él)

## 2026-10-27 · A típusellenőrzés a teljes projektre fut
- **Döntés:** a CI és a `scripts/check.sh` a `npm run typecheck`-et (`tsc --noEmit`, a gyökér `tsconfig.json`) futtatja; a `typecheck:src` megmarad, de csak a `.ts` fájlokat fedi.
- **Miért:** a `tsconfig.src.json` `include`-ja `src/**/*.ts`, így egyetlen `.tsx` (képernyők, komponensek, `AppBoot.tsx`) sem volt ellenőrizve. A teljes futás zöld, de csak azért, mert 26 `.tsx` fájl `// @ts-nocheck`-kel kikapcsolja magát (`docs/bugs.md` B3); az új fájlok és a maradék kettő viszont már ellenőrzöttek.
- **Érinti:** `package.json`, `.github/workflows/ci.yml`, `scripts/check.sh`

## 2026-10-27 · Az EAS production build és submit nincs tiltva a guardban
- **Döntés:** a `.claude/guard.json` csak a `main`-re pusholást tiltja; az EAS parancsokra a `CLAUDE.md` szabálya vonatkozik (csak külön engedéllyel).
- **Miért:** Gyula kérése.
- **Érinti:** `.claude/guard.json`, `CLAUDE.md`

## 2026-10-28 · Expo SDK 55 és a `zod` felülírása
- **Döntés:** Expo SDK 54 → 55 (React Native 0.83, React 19.2); a `package.json` `overrides` a `zod`-ot `^4.6.7`-re emeli; új függőség: `expo-system-ui`; az `app.json`-ból kikerült az `android.edgeToEdgeEnabled` (az SDK 55-ben mindig be van kapcsolva).
- **Miért:** B12. Az `npm audit fix` 31-ből 12 találatot hagyott, az SDK 55 9-re vitte le. Az SDK 56–58 sem old meg többet. Az utolsó magas találat a `zod` 3.x az `@expo/cli`-ben (build-eszköz, nem kerül az appba), amihez nincs javított 3.x kiadás; a zod 4-gyel az `expo config` és az `expo prebuild` lefut. Az `expo-system-ui` a `userInterfaceStyle: light` beállításhoz kell. Gyula engedélyezte.
- **Érinti:** `package.json`, `app.json`, `README.md`; ha az Expo felhoz zod 4-et, az override törölhető.

## 2026-10-28 · Képernyőkép-tiltás kapcsolható beállításként
- **Döntés:** új függőség `expo-screen-capture` (~55.0.18); Beállítások → Privacy → „Block screenshots” (`user_settings.block_screen_capture`, alapból ki). Bekapcsolva Androidon `FLAG_SECURE`: nincs képernyőkép és felvétel, az appváltóban nincs előnézet. Az érték az adatbázisban van, ezért az app a feloldás után alkalmazza; zárolt állapotban nincs rajta adat.
- **Miért:** B10. Az appváltó-előnézetre a háttérbe lépéskori azonnali zárolás nem garancia, a `FLAG_SECURE` az; de a képernyőkép-készítést megakadályozza, ezért nem alapértelmezett. A könyvtár három fölösleges jogosultságot hozna (`READ_EXTERNAL_STORAGE`, `READ_MEDIA_IMAGES`, `DETECT_SCREEN_CAPTURE`, csak a képernyőkép-figyelőhöz kellenek), ezek az `app.json` `blockedPermissions` listájában vannak. Gyula kérte.
- **Érinti:** `package.json`, `app.json`, `src/utils/screenCapture.ts`, `src/db/repositories/settings.ts`, `src/screens/SettingsScreen.tsx`, `AppBoot.tsx`

