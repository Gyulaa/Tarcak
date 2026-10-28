# Spec: havi kimutatás exportja (CSV)

Állapot: **jóváhagyva (Gyula, 2026-10-28), v1: sima CSV, titkosítás és vágólap nélkül.** Készült: 2026-10-28.

## Cél

Gyula egy gombnyomással kapjon egy anonimizált, havi bontású bevétel/kiadás kimutatást CSV fájlként, amit táblázatkezelőben (LibreOffice, Excel, Sheets) diagramozhat. Az app adatvédelmi modellje nem lazul: a kimutatás alapból a lehető legkevesebb információt tartalmazza (nincs tranzakciócím, zsebnév, pontos dátum, azonosító), az extra részletet (kategórianevek) és az eszközkört a felhasználó kapcsolja be tudatosan. Az export titkosítatlan fájl, ezt a felület kimondja, mielőtt a fájl elhagyja az appot.

## Viselkedés (elfogadási feltételek)

**Tartalom**
- [ ] Csak `income` és `expense` tranzakciók számítanak; a `transfer` soha nem kerül a kimutatásba (egyezik a Statisztika `getCategorySlices`-ával).
- [ ] Hónap = naptári hónap a **készülék időzónája szerint**, az export pillanatában érvényes zónával. A határ 23:59:59.999 / 00:00:00.000 helyesen oszlik meg.
- [ ] Az időszak egész naptári hónapokra igazodik (a kiválasztott kezdet hónapjának elejétől a vég hónapjának végéig). Az alapérték: az utolsó 12 naptári hónap, a folyó hónappal együtt. A folyó (még tartó) hónap az előnézetben „so far” jelölést kap; a CSV-ben nincs jelölés.
- [ ] Legfeljebb 240 hónap exportálható; több esetén a felület szól, és szűkíteni kér.
- [ ] Összegek **pontosak**: nincs `number`-aritmetika, a szummák szövegként jönnek az SQL-ből és `bigint`-ként adódnak össze (2^53 minor fölött is, vö. `docs/bugs.md` B11). A kiírt érték a teljes pontosságú tizedestört (nem a megjelenítési kerekítés), a záró nullák nélkül, csoportosítójel nélkül.
- [ ] `expense` összege pozitív szám a fájlban (a kiadás nagysága); `net = income − expense`. Negatív bevétel/kiadás (visszatérítés) a szummába előjelesen számít, nem tűnik el.
- [ ] Pénznemek: nincs árfolyam, ezért soha nincs pénznemek közti összegzés; minden sor egy pénznemhez tartozik. A felület felsorolja a tartományban aktivitással bíró pénznemeket, alapból mind be van jelölve; a kihagyott pénznem nem kerül a fájlba (a pénznemek köre is érzékeny lehet).
- [ ] Hatókör: ugyanaz a három, mint a Statisztikán: minden zseb / egy zseb / Jar nélkül (`StatisticsScope`).

**Két elrendezés, az egyiket a „Break down by category” kapcsoló választja (alapból KI)**
- [ ] KI: összesítő, `month,currency,income,expense,net`: egy sor hónaponként és pénznemenként, a tartomány **minden** hónapjára (üres hónapra 0-k), hogy az időtengely folytonos legyen.
- [ ] BE: hosszú alak, `month,currency,kind,category,amount`: csak a nem nulla szummák, `kind` = `income` | `expense`, a `category` a kategória neve, vagy `Uncategorized`. Ez az egyetlen hely, ahol felhasználói szabad szöveg (kategórianév) a fájlba kerül; a kapcsoló mellett figyelmeztető szöveg áll erről.
- [ ] A `month` formátuma `YYYY-MM`. A rendezés: hónap növekvő, pénznem ábécé, `income` a `expense` előtt, kategória név szerint.
- [ ] Nincs más oszlop: nincs zsebnév/-azonosító, tranzakciócím, azonosító, időbélyeg, eszközinfó.

**CSV formátum**
- [ ] Két előbeállítás, alapból a magyar: **Hungarian** (elválasztó `;`, tizedesjel `,`) és **International** (`,` és `.`). A választás nem tárolódik (nincs új `user_settings` kulcs), minden megnyitáskor az alap.
- [ ] UTF-8 BOM-mal (hogy a magyar ékezetek Excelben jók legyenek), CRLF sorvég, RFC 4180 szerinti idézés (elválasztót, idézőjelet, sortörést tartalmazó cella idézőjelben, a belső `"` duplázva).
- [ ] **CSV-injekció ellen**: ha egy szöveges cella (kategórianév) `=`, `+`, `-`, `@`, tab vagy CR karakterrel kezdődik, elé `'` kerül. Az összegcellákra ez nem vonatkozik (a negatív szám `-`-lel kezdődik).
- [ ] Fájlnév: `tarcak-report-YYYY-MM-DD.csv` (csak az export napja).

**Folyamat és adatvédelem**
- [ ] Az export képernyő előnézete **ugyanabból a függvényből** jön, mint a fájl: a havi összesítő táblázatot (hónap, pénznem, bevétel, kiadás, nettó) mutatja, és kategóriabontásnál kiírja a kategóriák számát és hogy a nevek bekerülnek. Amit az előnézet mutat, az kerül a fájlba, semmi más.
- [ ] „Export CSV” gomb → megerősítő felugró: „Ez a fájl **nincs titkosítva**. A megosztás után az a program őrzi, amelyikkel megosztod.” → megosztás-lap (`expo-sharing`). A megosztás alatt a zárolás-háttérben felfüggesztése él (`suspendVaultLockOnBackground` / `resumeVaultLockOnBackground`, mint a mentésnél), `finally`-ben visszaállítva.
- [ ] A fájl a cache-ben jön létre; a következő exportnál és a képernyő megnyitásakor a `tarcak-report-` előtagú fájlok törlődnek (best effort). Azonnali törlés nincs: Androidon a fogadó app aszinkron olvashatja.
- [ ] Hálózati hívás, analitika, napló az adatról: nincs. A CSV tartalma nem kerül logba.
- [ ] Weben letiltva (mint a mentés). Ha a megosztás nem érhető el: a felület szól, a fájl nem marad látható helyen.
- [ ] Üres tartomány (nincs `income`/`expense` a kiválasztott szűrőkkel): a gomb le van tiltva, a felület megmondja miért.

## Hatókörön kívül

- Vágólapra másolás. Gyula említette, de az űrlapon nem ezt választotta; ráadásul Androidon a vágólap-előzmény és a vágólap-szinkron adatot szivárogtathat, és az `expo-clipboard` `setStringAsync`-ja tudomásom szerint nem jelöli a tartalmat érzékenynek. Ha mégis kell, külön döntés: az export képernyőn egy második gomb ugyanazzal a `buildReportCsv` kimenettel, saját figyelmeztetéssel (a függőség már megvan: `expo-clipboard`).
- Képes riport (PNG/PDF): új függőséget igényelne (képernyőkép-rögzítés), külön kérdés.
- Tranzakciónkénti export, tranzakciócím, pontos dátum, zsebnevek.
- Átváltás közös pénznemre, havi egyenleg/vagyon-idősor, éves összesítés.
- A `.tarcak` mentés, a séma, `src/security/` változtatása: **nincs**. Új migráció sem kell.
- Az utolsó választás megjegyzése, ütemezett export.

## Terv

Minta: a repo-réteg a `src/db/repositories/statistics.ts`-t, a tiszta logika a `src/domain/transactionFilter.ts` + `tests/transactionFilter.test.ts` párost követi, a megosztás a `SettingsScreen.tsx` `runExportBackup`-ját (zárolás-felfüggesztés, `Sharing.isAvailableAsync`).

| Fájl | Mi |
|---|---|
| `src/domain/monthlyReport.ts` (új, tiszta) | `monthRangeFor(startMs, endMs)` → naptári hónapok `{ key: 'YYYY-MM', fromMs, toMs }` listája a helyi időzóna szerint (a határok `new Date(y, m, 1)`-ből, így DST-biztos); `formatMinorExact(minor: bigint, decimalMark)`; `csvCell`; `buildReportCsv(rows, options)` és `buildReportPreview(rows, options)`. Nincs RN/DB import, így a Node-tesztek futtatják. |
| `src/db/repositories/report.ts` (új) | `getReportRows({ months, scope, currencies })` → havonta egy csoportosított lekérdezés (`GROUP BY currency, kind, category_id`, `occurred_at >= ? AND occurred_at < ?`), a szumma `CAST(... AS TEXT)`; kategórianevek `LEFT JOIN categories`. A havi határok JS-ből jönnek, ezért nem kell SQL-es időzóna-kezelés (a `strftime('localtime')` Androidon nem megbízható). Zsebszűrés: ugyanaz a SQL-rész, mint `getCategorySlices`-ban; ezt kiemeljük egy exportált `scopeSql(scope)` segédbe `statistics.ts`-ben, és a `getCategorySlices` is azt használja. |
| `src/utils/reportFile.ts` (új) | `writeReportFile(csv)` → cache `tarcak-report-YYYY-MM-DD.csv`, BOM-mal; `purgeReportFiles()`. A `src/security/`-hez nem nyúlunk (a `purgeBackupCacheCopies` ott marad, a jelentésfájlnak saját, ugyanolyan takarítója van). |
| `src/screens/ReportExportScreen.tsx` (új) | Szűrők: időszak (`TimeRangePickerField`, kimenet hónapokra igazítva), hatókör, pénznemek (többes választó), „Break down by category”, formátum-előbeállítás; előnézet; Export gomb. |
| `src/navigation/types.ts`, `MainNavigator.tsx` | `ReportExport: undefined` útvonal. |
| `src/screens/StatisticsScreen.tsx` | Egy „Export report…” gomb (a kimutatás a statisztika szerves része), az útvonalra visz. |
| `README.md`, `docs/decisions.md`, `STATE.md` | Új szakasz a README-ben (mit tartalmaz a fájl, hogy titkosítatlan, hogy nincs hálózat); döntés-bejegyzés; állapot. |

Új függőség nincs (`expo-sharing`, `expo-file-system` megvan). Új migráció nincs.

## Feladatok

Új ág a `main`-ről (`feat/monthly-report-export`; a jelenlegi `fix/remaining-bugs` beolvadt). Mindegyik feladat külön commit; tesztet előbb, aztán kód; `scripts/check.sh` = OK.

1. [x] **Tiszta logika + tesztek** (`src/domain/monthlyReport.ts`, `tests/monthlyReport.test.ts`): `monthRangeFor` (hónaphatár, év vége, DST-váltás hónapja, 240 fölötti elutasítás); `formatMinorExact` (bigint > 2^53, negatív, 0, tizedesjel `,`/`.`, záró nullák); `csvCell` (elválasztó, idézőjel, sortörés, `=`/`+`/`-`/`@`/tab injekció); `buildReportCsv` mindkét elrendezésre (üres hónap 0, `Uncategorized`, rendezés, BOM + CRLF, kihagyott pénznem, negatív bevétel, `net`).
2. [x] **Repo** (`src/db/repositories/report.ts`, `scopeSql` kiemelése `statistics.ts`-ből): a három hatókörre. Egységteszt nincs rá (a tesztfutónak nincs SQLite-ja), ezért a SQL-nek nincs logikája a tiszta réteg fölött; az ellenőrzés a 6. feladatban.
3. **Fájl** (`src/utils/reportFile.ts`): írás + takarítás.
4. **Képernyő és útvonal** (`ReportExportScreen.tsx`, navigáció, Statisztika-gomb): szűrők, előnézet, üres állapot, web letiltva, megerősítő felugró, megosztás a zárolás-felfüggesztéssel. A képernyőszövegek angolul; színek `useAppTheme()`-ből (`design` skill).
5. **Dokumentáció**: README-szakasz, `docs/decisions.md`, `STATE.md`; `privacy-check` skill lefuttatva és az eredménye ide beírva.
6. **Ellenőrzés eszközön** (lásd lent), hibák a `docs/bugs.md`-be.

## Ellenőrzés

- `scripts/check.sh` → `OK`; a `npm test` tartalmazza az új teszteket.
- Eszközön, teszt-vaulttal (nem a valódi adattal), ezekkel az adatokkal: egy hónap-határ előtti és utáni tranzakció (23:59 / 00:00 helyi idő); 2^53 fölötti összeg (pl. 1 000 000 000 HUF); negatív bevétel; két pénznem; transzfer (nem szerepelhet); egy `=HYPERLINK("x")` nevű és egy `a;b"c` nevű kategória; Jar-ba menő tranzakció (a „Jar nélkül” hatókörben ne szerepeljen).
- A kapott CSV-t LibreOffice-ban megnyitni mindkét előbeállítással: ékezetek, oszlopok, a képlet-kategórianév szövegként látszik, a havi összegek egyeznek a Statisztika kategóriakártyáival ugyanarra a hónapra és szűrőre.
- Adatvédelem: a fájlban `grep` a teszt-zsebnevekre és tranzakciócímekre → nincs találat; kategóriabontás nélkül a fájlban nincs kategórianév; repülő üzemmódban is működik (nincs hálózat); a `security:scan` zöld; a megosztás alatt nem zár az app, utána a háttérbe tétel zár.
- `privacy-check`: az új adatút (titkosítatlan fájl az eszközről) a README-ben és a felületen is ki van mondva; a mentés/`.tarcak` formátum érintetlen.

## Nyitott pont

- A vágólapos opció (lásd „Hatókörön kívül”): kell-e, és ha igen, külön-e vagy ebben a változatban.
- Titkosítható-e a fájl (lásd a válaszban): jelenleg nincs a specben, a fájl sima CSV.

Eldöntve (2026-10-28, Gyula): a belépési pont a Statisztika képernyő; vágólapos opció nincs ebben a változatban.
