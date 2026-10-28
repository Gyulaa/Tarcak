# Állapot

Frissítve: 2026-10-27. Egy oldal: a `/agentic-code:save-work` írja újra, a `/agentic-code:resume-work` olvassa először.

## Mi ez
Helyi, titkosított személyes pénzügyi app (Expo / React Native). Verzió: 1.2.3 (Android versionCode 5).

## Most
- Claude-beállítás: a `chore/claude-setup` ágon kész (CLAUDE.md, jegyzetek, check szkript, hookok, guard, teljes típusellenőrzés a CI-ben, DESIGN.md), commitolva, pushra és PR-ra vár (külön engedéllyel). Közben kiderült: 26 `.tsx` fájl `@ts-nocheck` (B3).

## Nyitott ágak és PR-ok
- `chore/claude-setup` (még nincs pusholva)

## Blokkol / várunk
- (nincs)

## Következő lépés
1. B3: a `// @ts-nocheck` kivezetése fájlonként (364 rejtett típushiba, a kisebb fájlokkal kezdve); amíg ez nincs meg, a típusellenőrzés a felületi kódot nem védi.
2. B2: kontraszt a gombfeliratokon (`DESIGN.md` Colors).
3. Unit tesztek a tiszta logikára (`amountMinor`, `jarAdvancedMath`, `jarAdvancedChartModel`, `backupFormat`); ehhez kell egy tesztfuttató, ami új függőség, tehát előbb döntés.
4. A README "Still to add" pontjai: szerkeszthető `occurred_at`, zseb átnevezés UX.

## Súrlódás
- (még nincs; soronként: mi volt lassú vagy hibázott többször, milyen gyakran)
