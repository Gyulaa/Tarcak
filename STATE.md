# Állapot

Frissítve: 2026-10-28. Egy oldal: a `/agentic-code:save-work` írja újra, a `/agentic-code:resume-work` olvassa először.

## Mi ez
Helyi, titkosított személyes pénzügyi app (Expo / React Native). Verzió: 1.2.3 (Android versionCode 5).

## Most
- 2026-10-27: teljes átvizsgálás (B4–B21 a `docs/bugs.md`-ben), a `@ts-nocheck` kivezetése (B3) és 13 hiba javítása, plusz a kiírt összegek kerekítése (auto + eszközönként, migráció 0008). Döntések: `docs/decisions.md` (2026-10-27).
- Egységtesztek: `npm test` (Node beépített futtató, 28 teszt), a `check.sh` futtatja.
- Eszközön még semmi nincs kipróbálva (lásd lent).

## Nyitott ágak és PR-ok (egymásra épülnek, egyik sincs pusholva)
1. `chore/claude-setup` (main-ről): Claude-beállítás.
2. `fix/ts-nocheck` (az 1-re): B3 + az átvizsgálás hibanaplója.
3. `fix/review-findings` (a 2-re): javítások B4–B21-ből + kerekítés.
Merge sorrendben; push és PR csak külön engedéllyel.

## Blokkol / várunk
- Gyula: eszközteszt (dev build) a `fix/review-findings`-en: export + import (v2 formátum, csere és visszagörgetés), Jar-elosztás, jelszómegerősítés, Asset types → Decimals shown, háttérbe lépés zárolása. A régi app a v2 mentést nem nyitja.
- Gyula döntése: B12 (függőség-frissítés, 25 sebezhetőség, a Security scan június óta piros), B10 Android-része (`expo-screen-capture`, új függőség).

## Következő lépés
1. Eszközteszt, utána push + PR-ok (engedéllyel).
2. Nyitott hibák: B11 (2^53 fölötti egyenlegösszegek), B15 (History szűrés SQL-ben, lapozás), B19 (jelszócsere felület), B2 (kontraszt), B10/B16/B20/B21 maradék része.
3. README „Still to add”: szerkeszthető `occurred_at`, zseb átnevezés UX.

## Súrlódás
- A pre-commit check a teljes munkafát típusellenőrzi, nem csak a stage-elt fájlokat: fájlonkénti `@ts-nocheck`-kivezetésnél a többi fájlba vissza kellett tenni a direktívát (egyszer, kb. 2 perc).
