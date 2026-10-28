# Hibák

Ismert, még nem javított hibák (és a nemrég javítottak a következő kiadásig). A következő ID a legnagyobb meglévő szám + 1.

| ID | Súlyosság | Állapot | Mi | Hol | Eredet |
|---|---|---|---|---|---|
| B2 | közepes | nyitott | A fehér gombfelirat (`onPrimary`) a `primary`-n 12 palettaváltozatból 9-ben 4.5:1 alatt van (pl. sötét forest 1.87, sötét yellow 1.97, világos terracotta 3.98); a kiválasztott zsebsor szövege világos forest/yellow/red/ocean alatt is elbukik. Részletek: `DESIGN.md` Colors | `src/theme/colorThemes.ts` | - |
| B3 | magas | nyitott | 28 `.tsx` fájlból 26 elején `// @ts-nocheck` áll (a Genesis commit óta), így a típusellenőrzés a képernyőket és komponenseket valójában nem nézi. Kivéve 364 hiba jön elő (2026-10-27): 187 TS2339, 80 TS7006, 55 TS2345; legtöbb: `StatisticsScreen` 69, `JarAdvancedAssetEditor` 61, `HistoryScreen` 48 | `src/screens/`, `src/components/`, `AppBoot.tsx` | f2e56b7 |
| B1 | közepes | javítva (`chore/claude-setup`) | A CI típusellenőrzése egyetlen `.tsx` fájlt sem fedett le (a `tsconfig.src.json` csak `src/**/*.ts`); most a teljes projekt fut, de lásd B3 | `tsconfig.src.json` | - |
