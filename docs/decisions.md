# Döntések

Tartós döntésenként egy bejegyzés, a legújabb elöl. Változó döntést helyben szerkesztünk (a változás dátumával), nem duplikálunk. A korábbi döntések háttere a `README.md`-ben van (biztonsági modell, séma).

## 2026-10-27 · A típusellenőrzés a teljes projektre fut
- **Döntés:** a CI és a `scripts/check.sh` a `npm run typecheck`-et (`tsc --noEmit`, a gyökér `tsconfig.json`) futtatja; a `typecheck:src` megmarad, de csak a `.ts` fájlokat fedi.
- **Miért:** a `tsconfig.src.json` `include`-ja `src/**/*.ts`, így egyetlen `.tsx` (képernyők, komponensek, `AppBoot.tsx`) sem volt ellenőrizve. A teljes futás zöld, de csak azért, mert 26 `.tsx` fájl `// @ts-nocheck`-kel kikapcsolja magát (`docs/bugs.md` B3); az új fájlok és a maradék kettő viszont már ellenőrzöttek.
- **Érinti:** `package.json`, `.github/workflows/ci.yml`, `scripts/check.sh`

## 2026-10-27 · Az EAS production build és submit nincs tiltva a guardban
- **Döntés:** a `.claude/guard.json` csak a `main`-re pusholást tiltja; az EAS parancsokra a `CLAUDE.md` szabálya vonatkozik (csak külön engedéllyel).
- **Miért:** Gyula kérése.
- **Érinti:** `.claude/guard.json`, `CLAUDE.md`
