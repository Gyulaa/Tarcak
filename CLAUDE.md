# Tarcak

Helyi, titkosított személyes pénzügyi app (Expo / React Native, TypeScript strict): zsebek, több pénznem, egységes főkönyv. Használja: Gyula (egyszemélyes projekt, nyilvános GitHub-repó).

Kezdés: `STATE.md` (hol tartunk, egy oldal). A részletes kontextus (séma, biztonsági modell, fogalmak) a `README.md`-ben van; ez a fájl csak a mindig érvényes korlátokat tartalmazza.

## Parancsok
```bash
npm ci                     # egyszer, klónozás után (a check enélkül nem fut)
npm run start:lan          # dev szerver fizikai eszközhöz (natív modulok miatt nem Expo Go)
scripts/check.sh           # teljes típusellenőrzés + biztonsági minták; "OK" = zöld (a pre-commit hook --staged módban futtatja)
npm run security:scan      # mint a CI: npm audit is (hálózat kell); a check.sh offline, audit nélkül futtatja
git config core.hooksPath .githooks   # klónonként egyszer
```
Automatikus teszt nincs; a `npm run test:jar` csak kézi ellenőrzőlistát ír ki.

## Ami nem alku tárgya
- Az összegek előjeles egészek, 1 egység = 10^8 minor (`src/utils/amountMinor.ts`). Lebegőpontos pénzszámolás nincs.
- Migráció csak új, következő sorszámú fájlként (`src/db/migrations/000N_*.ts`); meglévő migrációt nem módosítunk.
- A `src/security/` (KDF, DEK-csomagolás, SQLCipher, mentésformátum) változása csak kifejezett kérésre, és a `.tarcak` mentés visszafelé kompatibilis marad, vagy verziót lép.
- Az adat a készüléken marad: hálózati hívás, analitika, új külső szolgáltatás csak kérdés után.
- `@ts-nocheck` és `@ts-ignore` nem kerül a kódba (a `security:scan` elbukik rájuk); típushibát javítunk, nem elnémítunk.
- Új függőség csak kérdés után. Színek a `useAppTheme()`-ből, nem nyers hex a képernyőkben.
- Valódi felhasználói adat (`.tarcak` mentés, kibontott `.sqlite`) nem kerül a projektmappába, és Claude nem olvassa.
- Push, PR, merge, EAS build és submit csak külön engedéllyel; `main`-re push soha (`.claude/guard.json`).
- Titok nem kerül gitbe, logba, jegyzetbe; a `.env*` ignorált marad.

## Nyelv
- Jegyzetek (`STATE.md`, `docs/`) és ez a fájl: magyar.
- Kód, kommentek, commit üzenetek, README: angol. A felület szövegei: angol.

## Hol mi van
| Mire van szükség | Mit olvass |
|---|---|
| Hol tartunk, mi a következő | `STATE.md` |
| Miért ilyen valami | `docs/decisions.md` |
| Ismert hibák | `docs/bugs.md` |
| Séma, fogalmak, biztonsági modell, mappaszerkezet | `README.md` (a megfelelő szakasz, ne az egész) |
| Android kiadás, dev hálózat | `docs/ANDROID_GITHUB_RELEASE.md`, `docs/DEVELOPMENT_NETWORK.md` |
| Téma, színek, felületi szabályok | `DESIGN.md`, `src/theme/` |

## Munkamód
Tömörítéskor maradjon meg a módosított fájlok listája, a check parancs és a nyitott döntés.
Az agentic-code skillek: `working-mode` mindig; kódváltoztatás előtt `quality-gate` és `match-the-codebase`; egymondatosnál nagyobb változásnál `spec`; ág, commit, PR előtt `git-workflow`; adatkezelést érintő változásnál (mentés, export, új adatmező) `privacy-check`; felületi munkánál `design`, nagy UI-változás után `design-review`. Munkamenet elején `/agentic-code:resume-work`, végén `/agentic-code:save-work`.
