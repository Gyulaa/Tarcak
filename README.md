# Tarcak

**Repository:** [github.com/Gyulaa/Tarcak](https://github.com/Gyulaa/Tarcak)

Local-first personal finance app: **pockets** (budget segments), **multi-currency balances**, and a **unified ledger** for income, expenses, and transfers between pockets. All data stays on the device and is stored **encrypted**; unlocking the data uses a **password** you choose (not biometrics as the primary secret).

**App version (native):** `1.2.1` in [`app.json`](app.json) (`android.versionCode` `2`).

## Current project setup

| Item | Notes |
|------|--------|
| **Runtime** | Expo SDK `~54`, React Native `0.81`, React `19`, TypeScript `strict` |
| **Entry** | `index.ts` → `App.tsx` (fonts) → `AppBoot.tsx` (vault gate + main UI) |
| **Architecture** | New Architecture enabled (`newArchEnabled: true` in `app.json`) |
| **Implemented** | **Vault** (PBKDF2 + AES-GCM wrapped DEK, SQLCipher, lock on background). **Schema** migrations **`0001`–`0006`** (auto-applied on unlock). **Repositories:** `pockets`, `transactions`, `settings`, `assetTypes`, `jar`, `jarAdvanced`, `statistics`. **UI:** Home (balances by currency, Jar shortcut), Pockets + pocket detail, **History** (scope chip + multi-filter), **Statistics** charts, **Settings** (appearance, Jar toggles, archived pockets, **encrypted backup**), asset-type catalog, transaction editor. **Jar:** Record income, Distribute (basic or Advanced rules), Jar split screen, recent Jar transactions. **Advanced Jar:** hub + per-asset **visual editor** (Balance Chart, split preview bar, milestone knots). **`ModalSelectField`** everywhere including **multi-select** filter sheets (long-press). **Themes:** six accent palettes + dark mode; **unlock screen** uses cached appearance. **Support:** BTC donation address on Home. **Encrypted `.tarcak` backup** export/import. |
| **Still to add** | Polish (**editable** `occurred_at` in the transaction editor; pocket rename UX), automated tests beyond CI typecheck + `test:jar` checklist, optional FX / converted home total |

## Support / donations

Addresses live in [`src/constants/donations.ts`](src/constants/donations.ts) and the Home support strip (`DonationFooter`).

| Asset | Address |
|-------|---------|
| **Bitcoin (BTC)** | `bc1q7ztcxrnc5hlkms02m79rxsv4mqxmuh8f8tjsrk` |
| **Monero (XMR)** | Placeholder (`soon`) in UI |

---

## Appearance (themes)

**Settings → Appearance**

- **Color palette** — `terracotta` (default), `ocean`, `forest`, `slate`, `red`, `yellow` ([`src/theme/colorThemes.ts`](src/theme/colorThemes.ts)). Each id has light + dark `AppColors`.
- **Black theme** — dark surfaces and light text app-wide.

Choices are persisted in **`user_settings`** while unlocked and mirrored to **SecureStore** via [`src/theme/appearanceCache.ts`](src/theme/appearanceCache.ts) (`tarcak_ui_dark_theme`, `tarcak_ui_color_theme_id`) so the **password / unlock screen** matches the last palette before the database opens. Backups optionally include this snapshot.

Semantic colors (not raw hex in screens) come from **`useAppTheme()`** in [`src/theme/ThemeContext.tsx`](src/theme/ThemeContext.tsx).

---

## Encrypted backup & restore

**Settings → Backup & restore** (native only; disabled on web).

| Password | Role |
|----------|------|
| **Vault password** | Unlocks the app after restore (unchanged). |
| **Backup password** | Encrypts the `.tarcak` file at rest (cloud, USB, email). |

**Export:** flushes WAL (`PRAGMA wal_checkpoint(FULL)`), then reads the **on-disk SQLCipher-encrypted file directly** (raw encrypted bytes — not `serializeAsync`, which returns decrypted in-memory pages and was the root cause of the historic import bug), bundles vault metadata (salt, wrapped DEK, PBKDF2 iteration count), appearance, and a **contents manifest** (pockets, transactions, asset types, Jar basic + Advanced rules, settings) → JSON → AES-GCM with the backup password → file `tarcak-backup-YYYY-MM-DD.tarcak` in cache, then **share** sheet ([`expo-sharing`](https://docs.expo.dev/versions/latest/sdk/sharing/)). While the share sheet is open, automatic **lock-on-background is suspended** (depth counter in `session.ts`) so the session stays alive.

**Import:** document picker ([`expo-document-picker`](https://docs.expo.dev/versions/latest/sdk/document-picker/)) with the same **lock suspension** (so choosing a file does not kick you to the password screen) → `content://` URIs are copied to cache first (Android) → decrypt while unlocked → replace DB file + SecureStore vault → record restore metadata ([`backupImportMeta.ts`](src/security/backupImportMeta.ts)) → lock session (user unlocks with **vault** password). **Destructive** on device: overwrites local data. After unlock, **Home** and **Settings** show a **”Restored from backup”** banner (backup created / imported timestamps) until dismissed. **Legacy recovery:** if the imported DB file is plain SQLite (created by an older build that used `serializeAsync`), `db/client.ts` automatically encrypts it in place with `PRAGMA rekey` on the first unlock — no user action needed.

Implementation: [`src/security/backup.ts`](src/security/backup.ts), [`src/security/backupCrypto.ts`](src/security/backupCrypto.ts), [`src/security/backupFormat.ts`](src/security/backupFormat.ts), [`src/security/backupImportMeta.ts`](src/security/backupImportMeta.ts), [`src/components/BackupPasswordModal.tsx`](src/components/BackupPasswordModal.tsx), [`src/components/BackupRestoredBanner.tsx`](src/components/BackupRestoredBanner.tsx). Imported directly from Settings (not the `security/index` barrel) so backup code does not load at cold start.

**Before upgrading** an old install, export a backup if you want a rollback copy.

---

## Upgrading from an older build

Safe to install over an existing vault: on unlock, [`runPendingMigrations`](src/db/migrations/runner.ts) applies any of **`0001`–`0006`** not yet recorded in `schema_migrations`. No new migration is required for recent UI-only releases if you are already at version **6**.

| Migration | What changes |
|-----------|----------------|
| `0001` | Initial pockets, transactions, settings |
| `0002` | Amount scale → 10⁻⁸ minor units (multiplies legacy rows) |
| `0003` | `asset_types` catalog seeded from existing currencies |
| `0004` | Jar pocket + `jar_distribution_rules` |
| `0005` | `pockets.archived` |
| `0006` | Advanced Jar tables |

First unlock after a big jump may take a few seconds. Wrong vault password still fails before migrations run. See **Forgot password** if you need a clean slate.

---

`app.json` enables the **expo-sqlite** config plugin with **`useSQLCipher: true`**. That only applies after a **native build** (`npx expo prebuild` / EAS / `expo run:*`). **Expo Go does not ship SQLCipher** — the app still runs, but the DB file is **plaintext** there (a console warning explains this). Use a **development build** to validate real encryption.

**CI:** GitHub Actions runs `npm ci` and `npm run typecheck:src` on push/PR (see [.github/workflows/ci.yml](.github/workflows/ci.yml)). **Security:** [`security.yml`](.github/workflows/security.yml) runs `npm run security:scan` (npm audit + static pattern gate) and dependency review on PRs; see [SECURITY.md](SECURITY.md).

**Android APK for GitHub Releases:** [docs/ANDROID_GITHUB_RELEASE.md](docs/ANDROID_GITHUB_RELEASE.md) (EAS Build `preview` profile → attach `.apk` to a Release).

**Typecheck:** `npm run typecheck:src` type-checks `src/**/*.ts` (security, DB client, migrations). Full-project `tsc` can still report upstream Expo / React Native typing noise.

**Security disclosures:** see [SECURITY.md](SECURITY.md).

**VPN / tunnel issues:** If `npx expo start --tunnel` fails (e.g. `Cannot read properties of undefined (reading 'body')`), that is a known limitation of Expo’s shared ngrok tunnel—not this repo. **`npm run start:localhost` + QR scan usually fails without USB**: the QR points at `127.0.0.1` on the **phone**, not your PC — use **`npm run start:lan`** (same Wi‑Fi), or USB with **`adb reverse`** and open **`exp://127.0.0.1:8081`** manually in Expo Go, or a custom tunnel — see [docs/DEVELOPMENT_NETWORK.md](docs/DEVELOPMENT_NETWORK.md).

**Why migrations:** They let you **evolve the SQLite schema across app releases** without wiping the user’s encrypted file. On each `openMainDatabase()`, pending steps run in order and are recorded in `schema_migrations`. DDL migrations are **not** wrapped in `BEGIN…COMMIT` because SQLite’s `CREATE TABLE` / `CREATE INDEX` perform an implicit commit, which breaks Expo’s `withTransactionAsync` wrapper.

---

## Implemented cryptography (accurate detail)

| Piece | Choice | Where |
|-------|--------|--------|
| **DEK** | 32 random bytes (CSPRNG) | `vault.ts` + `random.ts` (`expo-crypto`) |
| **KEK** | PBKDF2-HMAC-SHA256; iteration count from **SecureStore** per vault (default **100,000** in `constants.ts` for new vaults and for unlock when no stored value exists) | `kdf.ts`, `vault.ts`, `keystore.ts` |
| **Password form** | Unicode **NFKC** normalization before KDF | `passwordPolicy.ts` |
| **DEK at rest (metadata)** | AES-256-GCM (12-byte random nonce, empty AAD), versioned blob → Base64 in SecureStore | `wrapDek.ts` (`@noble/ciphers`) |
| **DEK in session** | Copy in memory while unlocked; `fill(0)` on lock (best-effort in JS) | `session.ts`, `lockdown.ts` |
| **SQLite file** | SQLCipher: `PRAGMA key = "x'<hex of 32-byte DEK>'"` | `db/sqlcipher.ts`, `db/client.ts` |
| **Background** | `AppState` → `inactive` / `background` closes DB and clears session DEK | `session.ts` (dynamic import of `lockdown.ts` avoids import cycles) |

**Dependencies (main):** `expo-secure-store`, `expo-crypto`, `expo-sqlite`, `expo-constants`, `expo-font`, `expo-clipboard`, `expo-file-system`, `expo-document-picker`, `expo-sharing`, `expo-linear-gradient`, `@noble/hashes`, `@noble/ciphers`, `@react-navigation/native`, `@react-navigation/native-stack`, `react-native-screens`, `react-native-safe-area-context`, `react-native-gesture-handler`, `react-native-svg`, `react-native-gifted-charts`, `zustand`.

**Changing `PBKDF2_ITERATIONS`:** New vaults store the count at creation; password change updates it. Existing installs **with** a stored value keep unlocking with their saved count. Installs that **lack** the key (very old data) still use whatever value is in `constants.ts` today — do not assume you can freely change the constant for those users. See [SECURITY.md](SECURITY.md).

---

## What “backend” means here

There is **no remote server**. The **backend** is the **on-device stack**:

1. **Security** — password-based key derivation, protecting the database encryption key, session lifecycle (lock when backgrounded).
2. **Database** — encrypted SQLite schema, migrations, and repositories.
3. **Domain** — types and pure functions (e.g. computing balances and home-screen aggregates).

The UI calls into repositories; repositories run SQL and map rows to typed models.

---

## Security model (password-first)

**Goals**

- Database file on disk is **unreadable** without the password.
- After unlock, decrypted access exists **in memory** while the app is active; **lock on background** clears sensitive session state and requires the password again (policy you can tune).

**Recommended pattern (two-layer keys)**

1. **Data encryption key (DEK)** — random key that actually encrypts the SQLite database (e.g. SQLCipher).
2. **Key encryption key (KEK)** — derived from the **password** using a slow KDF (e.g. Argon2id or PBKDF2 with high iteration count) and a **random salt**.

Store **salt** and **DEK wrapped with KEK** in the OS secure store (Expo: `expo-secure-store`). The **password is not stored**. On launch, user enters password → derive KEK → unwrap DEK → open DB.

**Why not derive the DB key directly from the password?** You can, but wrapping a random DEK allows **password changes** without re-encrypting the entire database.

**Threat model (short)**

- **Helps**: lost device, backup extraction of app files, casual access without password.
- **Does not guarantee**: malware on an unlocked device, rooted/kernel compromise, or someone watching you type the password.

Biometrics can be added later as a **convenience** that gates access to the password or a short-lived session — but the **authoritative secret** remains the password, per your preference.

**Forgot password:** There is no server reset. The unlock screen offers **“Forgot password? Erase data and start over”**, which deletes the vault (SecureStore) and the local SQLite file so you can **Create vault** with a new password. All previous pockets and transactions on that device are lost unless you have an **encrypted `.tarcak` backup** (Settings → export) to restore on a fresh vault.

---

## Domain concepts

### Pocket

A **pocket** is a user-defined bucket (e.g. “Daily”, “Savings”, “Crypto”). It does not have a single currency: the same pocket can hold **multiple currencies** as separate balances.

### Asset type (currency code)

Each transaction stores a **`currency` string** that must match a row in the **`asset_types`** catalog (code + display name). Users **define** codes (e.g. `HUF`, `USD`, `XMR`) under **Settings → Asset types**, then **pick** them when recording a transaction (no free-text codes on the form). **`default_currency`** in `user_settings` must refer to an existing catalog code.

Amounts are stored as **signed integers**: **one major currency unit = 10⁸ minor units** (8 decimal places), so values like `0.00000001` are exact. **Income / expense** may use negative amounts; **transfers** must be positive (enforced in SQLite and app validation). The UI accepts decimal strings; see `src/utils/amountMinor.ts`. **Never** use floating point for money in logic — only for display derived from integers.

### Jar (pool & distribute)

The vault has **one system pocket** with **`is_jar = 1`** (created by migration `0004`, default name “Jar”). It behaves like any other pocket in the ledger (income, expense, transfers). **Distribution:** either **basic split** (**Jar split** — target pockets and percentages as basis points summing to **10 000** = 100%) or, when **Advanced Jar** is enabled in Settings, **only** per-asset rules from **Advanced Jar** (ceiling + milestone splits; each asset in the Jar needs its own config). **Distribute** moves the **full** balance of a chosen asset from the Jar via **transfer** rows (integer split; remainder on the last target).

**Settings → Pool & distribute** toggles the feature. When **off**, the setting `jar_enabled` is false and the Jar pocket is **`archived = 1`**: it disappears from **Pockets**, **Home** shortcuts, and **new-transaction pocket pickers**, but **balances and history** still count in aggregates. Turning the feature **on** clears archive on the Jar row. `getPocket(id)` still returns archived pockets (e.g. opening the Jar from a disabled-state screen).

**Advanced Jar** (Settings → toggle + **Configure Advanced Jar…**): per-asset **default ceiling** and **milestone** splits. Between milestones, effective percentages **linearly blend** ([`src/domain/jarAdvancedMath.ts`](src/domain/jarAdvancedMath.ts)). **Distribute** uses only Advanced rules when the toggle is on (each asset in the Jar needs a config).

**Advanced Jar editor** ([`JarAdvancedAssetEditor`](src/screens/JarAdvancedAssetEditor.tsx)):

- **Split preview bar** — stacked bar + legend (theme-aware pocket colors).
- **Balance Chart** — X = Jar balance (asset amount), Y = 0–100% per pocket; one line per pocket in the rules; tap **knots** (ceiling / milestones) to edit; slide chart to **preview** automatic blend; **+ Milestone**.
- Preview mode shows pocket shares as **asset amounts** at the top; panel can **use preview as new milestone**.

Chart layout / sampling: [`src/domain/jarAdvancedChartModel.ts`](src/domain/jarAdvancedChartModel.ts). Colors: [`src/utils/pocketChartColors.ts`](src/utils/pocketChartColors.ts).

### Ledger transactions (single source of truth)

Every user-visible record is a **transaction** row. Balances are **derived** by summing effects per `(pocket_id, currency)` (acceptable for typical personal use; add materialized balance tables later if profiling says you need them).

**Transaction kinds**

| Kind | Meaning | Pockets affected |
|------|---------|------------------|
| `income` | Money in | One **credit** pocket |
| `expense` | Money out | One **debit** pocket |
| `transfer` | Move value between pockets | **Debit** pocket → **credit** pocket (same currency for v1; see below) |

Each record has a **title** (short label), **amount** (non-zero integer in minor units at 10⁻⁸ major), **currency** (must exist in `asset_types`), and **when it happened** (`occurred_at`, Unix ms). New saves set `occurred_at` to the current time; the editor **displays** the stored date when editing (changing it in UI is not implemented yet). **History** and pocket **recent lists** display this date; queries order by `occurred_at` descending.

**History screen** ([`HistoryScreen.tsx`](src/screens/HistoryScreen.tsx)):

- Optional **scope** from navigation (`pocketId`) — chip to widen to all pockets.
- Loads up to **500** recent transactions, then filters client-side.
- **Filters** (Type / Asset / Pocket): **tap** one option (closes sheet); **long-press** toggles **multi-select** with checkmarks (OR within each dimension).
- **Income** filter includes `kind = income` and **transfers into the Jar** (money pooled from other pockets).
- **Jar** always appears in the pocket filter list when the Jar pocket exists.

**v1 rule:** **Transfers are same-currency.** Cross-currency moves are either two transactions (sell/buy) or a future `exchange` type when you add rates — avoid ambiguous bookkeeping early.

### Home screen: “overall assets”

Without exchange rates, **you cannot sum HUF + USD + BTC into one meaningful number**. Plan:

- **Phase A (now):** Show **totals grouped by currency** (and per-pocket breakdown if useful).
- **Phase B (later):** `user_settings.default_currency` + cached FX/crypto prices → converted **estimated** total in one fiat column, clearly labeled as approximate.

---

## Database schema (logical)

SQLite tables (column types illustrative; adjust to your SQLCipher driver).

### `schema_migrations`

| Column | Type | Purpose |
|--------|------|---------|
| `version` | INTEGER PK | Applied migration id (monotonic) |
| `applied_at` | INTEGER NOT NULL | Unix ms when the migration finished |

### `pockets`

| Column | Type | Purpose |
|--------|------|---------|
| `id` | TEXT PK | UUID |
| `name` | TEXT NOT NULL | Display name |
| `sort_index` | INTEGER NOT NULL | UI ordering |
| `created_at` | INTEGER NOT NULL | Unix ms |
| `updated_at` | INTEGER NOT NULL | Unix ms |
| `is_jar` | INTEGER NOT NULL | `1` for the single system Jar (migration `0004`) |
| `archived` | INTEGER NOT NULL | `1` = hidden from `listPockets()` and pickers (Jar when pool feature off; migration `0005`) |

Partial unique index: at most one row with `is_jar = 1`.

### `asset_types`

| Column | Type | Purpose |
|--------|------|---------|
| `id` | TEXT PK | UUID |
| `code` | TEXT NOT NULL UNIQUE | Uppercase code stored on `transactions.currency` |
| `name` | TEXT NOT NULL | Display label |
| `sort_index` | INTEGER NOT NULL | UI ordering |
| `created_at` / `updated_at` | INTEGER NOT NULL | Unix ms |

### `jar_distribution_rules`

| Column | Type | Purpose |
|--------|------|---------|
| `id` | TEXT PK | UUID |
| `target_pocket_id` | TEXT NOT NULL FK | Regular pocket (not the Jar); `ON DELETE CASCADE` |
| `percent_bps` | INTEGER NOT NULL | Share in basis points (1–10000); all active rules must sum to **10000** |
| `sort_index` | INTEGER NOT NULL | Order for split calculation |
| `created_at` / `updated_at` | INTEGER NOT NULL | Unix ms |

**Advanced Jar** (migration `0006`, when `advanced_jar_enabled` is on): **`jar_advanced_assets`** (per-currency ceiling), **`jar_advanced_default_splits`**, **`jar_advanced_milestones`**, **`jar_advanced_milestone_splits`** — see `jarAdvanced` repository and `domain/jarAdvancedMath.ts`.

### `transactions`

| Column | Type | Purpose |
|--------|------|---------|
| `id` | TEXT PK | UUID |
| `kind` | TEXT NOT NULL | `income` \| `expense` \| `transfer` |
| `title` | TEXT NOT NULL | User label |
| `amount_minor` | INTEGER NOT NULL | Non-zero minor units (**10⁻⁸** of one major unit); signed allowed for `income` / `expense`; **transfers** must be > 0 (see migration `0002_amount_minor_scale`) |
| `currency` | TEXT NOT NULL | Must match `asset_types.code` (enforced in repositories) |
| `occurred_at` | INTEGER NOT NULL | When the user says the event happened (Unix ms); shown in History |
| `created_at` | INTEGER NOT NULL | Record creation |
| `updated_at` | INTEGER NOT NULL | Last edit |

Pocket linkage (nullable by kind):

| Column | Type | When set |
|--------|------|----------|
| `pocket_id` | TEXT FK → pockets.id | `income` (credit), `expense` (debit) |
| `from_pocket_id` | TEXT FK → pockets.id | `transfer` (debit) |
| `to_pocket_id` | TEXT FK → pockets.id | `transfer` (credit) |

**Constraints (enforce in app or DB triggers):**

- `income`: `pocket_id` set; `from`/`to` null.
- `expense`: `pocket_id` set; `from`/`to` null.
- `transfer`: `from_pocket_id` and `to_pocket_id` set, **distinct**; `pocket_id` null; `from` ≠ `to`.

### `user_settings` (key-value for future-proofing)

| Column | Type | Purpose |
|--------|------|---------|
| `key` | TEXT PK | e.g. `default_currency` |
| `value` | TEXT NOT NULL | JSON or plain string |

Known keys include **`default_currency`** (code string), **`jar_enabled`** (`1` / `0`), **`advanced_jar_enabled`** (`1` / `0`), and **`show_archived_pockets`** (`1` / `0`). When `jar_enabled` is turned off in the app, the Jar pocket is archived in the same write. Price APIs and last-fetched rates can live here or in dedicated tables later.

**Note:** Dark mode and accent palette are also cached in SecureStore for the vault gate (see **Appearance**); they are written from `ThemeContext` when you change Settings.

---

## Balance math (derived)

For each pocket `p` and currency `c`:

- **Income** into `p`: `+amount_minor` (signed `amount_minor` supported)
- **Expense** from `p`: `-amount_minor`
- **Transfer** from `p`: `-amount_minor` when `p = from_pocket_id` (`amount_minor` > 0)
- **Transfer** to `p`: `+amount_minor` when `p = to_pocket_id`

**Home “assets by currency”:** sum the above across all pockets, grouped by `currency`.

**Pocket screen:** same sum restricted to that pocket.

---

## Repository API (implemented surface)

- **Pockets:** `listPockets()` (non-archived only), `listRegularPockets()`, `getPocket()`, `getJarPocket()`, `createPocket()`, `renamePocket()`, `deletePocketIfUnused()`, `setJarPocketArchived()`.
- **Transactions:** `insertIncome` / `insertExpense` / `insertTransfer`, `updateTransaction`, `deleteTransaction`, `getTransaction`, `listTransactions({ pocketId?, limit, offset })` ordered by `occurred_at` DESC, `sumBalancesAll`, `sumBalancesForPocket`.
- **Settings:** `getSetting` / `setSetting`, `getDefaultCurrency` / `setDefaultCurrency`, `getJarEnabled` / `setJarEnabled` (also archives/unarchives the Jar), `getAdvancedJarEnabled` / `setAdvancedJarEnabled`, `getShowArchivedPockets` / `setShowArchivedPockets`.
- **Backup:** `exportEncryptedBackup`, `importEncryptedBackup` ([`src/security/backup.ts`](src/security/backup.ts)) — require unlocked session.
- **Asset types:** `listAssetTypes`, `createAssetType`, `updateAssetTypeName`, `deleteAssetType`, `currencyExists`, `requireRegisteredAssetCurrency`.
- **Jar:** `listJarDistributionRules`, `replaceJarDistributionRules`, `distributeJarCurrency`, `splitAmountByBps` (pure helper).
- **Jar advanced:** `listJarAdvancedSummaries`, `getJarAdvancedAssetDetail`, `saveJarAdvancedAsset`, `deleteJarAdvancedAsset`, `getJarAdvancedDistributeConfig`, `resolveAdvancedEffectiveBps`, etc.
- **Statistics:** `getBalanceTimeline`, `downsampleTimeline`, `getPocketSlicesAt`, `getEarliestOccurredAt` (for charts and time-range defaults).

---

## Folder structure (implementation target)

```text
src/
  security/
    constants.ts       # sizes, PBKDF2 iterations, SecureStore key names
    errors.ts            # typed errors
    encoding.ts          # hex + Base64 helpers
    random.ts            # CSPRNG via expo-crypto
    passwordPolicy.ts    # NFKC + minimum length
    kdf.ts               # PBKDF2 → KEK, zeroize helper
    wrapDek.ts           # AES-GCM wrap/unwrap DEK with KEK
    backupFormat.ts      # `.tarcak` JSON payload v1
    backupCrypto.ts      # backup-password AES-GCM
    backup.ts            # export / import (reads encrypted file directly; legacy rekey recovery)
    backupImportMeta.ts  # pending restore metadata (SecureStore → DB on first unlock)
    keystore.ts          # expo-secure-store accessors (+ vault snapshot for backup)
    vault.ts             # create / unlock / change password
    session.ts           # in-memory DEK + AppState listener
    lockdown.ts          # close DB + clear session
    index.ts             # public exports (backup imported ad hoc from Settings)
  theme/
    palette.ts           # AppColors type
    colorThemes.ts       # six accent families (light + dark)
    appearanceCache.ts   # SecureStore mirror for vault gate
    ThemeContext.tsx
    fonts.ts
  constants/
    donations.ts         # BTC / XMR support addresses
  db/
    sqlcipher.ts         # build PRAGMA key SQL from raw DEK
    client.ts            # PRAGMA key, foreign_keys=ON, runPendingMigrations, open/close
    migrations/
      types.ts
      runner.ts
      0001_initial.ts
      0002_amount_minor_scale.ts
      0003_asset_types.ts
      0004_jar.ts
      0005_pockets_archived.ts
      0006_jar_advanced.ts
      index.ts           # re-exports
    repositories/
      pockets.ts
      transactions.ts
      settings.ts
      assetTypes.ts
      jar.ts
      jarAdvanced.ts
      statistics.ts
  domain/
    types.ts
    jarAdvancedMath.ts       # milestone / ceiling BPS resolution
    jarAdvancedChartModel.ts # Balance Chart layout + effective % sampling
    jarAdvancedEditorTypes.ts
    jarAdvancedEditorSave.ts
  stores/
    ledgerStore.ts       # zustand: pockets + home balances refresh
  components/
    ModalSelectField.tsx   # dropdown picker; optional multiSelect (History filters)
    BackupPasswordModal.tsx
    BackupRestoredBanner.tsx
    DonationFooter.tsx
    jarAdvanced/
      JarAdvancedBalanceChart.tsx
      JarAdvancedSplitBar.tsx
      JarAdvancedSplitEditor.tsx
  navigation/
    types.ts
    LockVaultContext.ts
    MainNavigator.tsx
  screens/
    HomeScreen.tsx
    PocketsScreen.tsx
    PocketDetailScreen.tsx
    TransactionEditorScreen.tsx
    HistoryScreen.tsx
    StatisticsScreen.tsx
    SettingsScreen.tsx
    AssetTypesScreen.tsx
    JarScreen.tsx
    JarSplitScreen.tsx
    JarAdvancedHub.tsx
    JarAdvancedAssetEditor.tsx
  utils/
    amountMinor.ts         # parse/format; spaced thousands on integer part
    formatMinor.ts
    formatOccurredAt.ts
    pocketChartColors.ts   # stable per-pocket chart colors (theme-aware)
AppBoot.tsx              # vault gate (themed via appearanceCache) + SafeAreaProvider + MainNavigator when unlocked
scripts/
  jar-advanced-chart-selftest.mjs  # manual QA checklist (`npm run test:jar`)
  security-scan.mjs
```

Keep **SQL strings and migrations** out of React components.

---

## Roadmap alignment

| Your feature | Where it lives |
|--------------|----------------|
| Multi-currency pockets | `transactions` rows + balance aggregation |
| Transfers between pockets | `kind = transfer` + from/to FKs |
| Income / expense + title | `kind` + `title` |
| Edit + history | `updateTransaction`, `listTransactions` |
| Conducted date in UI | `occurred_at` stored + shown in History / pocket detail / editor (edit date: not yet) |
| Filter history by pocket | `listTransactions({ pocketId })` |
| History filters (type / asset / pocket) | Client-side on up to 500 rows; `ModalSelectField` tap = one, long-press = multi + ✓ |
| History Income + Jar | Income filter includes transfers **to** the Jar pocket |
| Appearance / themes | `colorThemes.ts` + `ThemeContext` + `appearanceCache` on vault gate |
| Encrypted backup | `backup.ts` → `.tarcak` file; separate backup password |
| Advanced Jar Balance Chart | `jarAdvancedChartModel` + `JarAdvancedBalanceChart` visual editor |
| Statistics charts | `statistics` repository + `StatisticsScreen` (`react-native-gifted-charts`) |
| Asset type catalog | `asset_types` + `assetTypes` repository + Settings / editor dropdowns |
| Jar pool & split distribute | `is_jar` pocket, `jar_distribution_rules`, `jar` repository, Jar / Jar split screens |
| Advanced Jar | `0006` tables + `jarAdvanced` repository + hub / per-asset editor; optional vs basic split |
| Jar off → archive pocket | `user_settings.jar_enabled` + `pockets.archived` + `setJarEnabled` |
| Encrypted storage | `db/client.ts` + SQLCipher (or equivalent) |
| Password unlock | `security/*` + lock on background |
| Default asset + API prices | `user_settings.default_currency` + optional FX tables later |

---

## Scripts

| Command | Purpose |
|---------|---------|
| `npm start` | Expo dev server |
| `npm run start:lan` | Dev server on LAN (physical device on same Wi‑Fi) |
| `npm run start:localhost` | Dev server on `127.0.0.1` (often needs USB + `adb reverse`) |
| `npm run android` / `ios` / `web` | Run native / web targets |
| `npm run typecheck:src` | Typecheck `src/**/*.ts` (CI) |
| `npm run test:jar` | Print Advanced Jar / Balance Chart manual QA checklist |
| `npm run security:scan` | `npm audit` + static secret-pattern gate |

**UI formatting:** Amounts show **spaced thousands** on the integer part (e.g. `1 000`, `54 333 234`) via `formatIntegerPartWithSpaces` in [`src/utils/amountMinor.ts`](src/utils/amountMinor.ts).

---


## License

(To be chosen when you publish open source, e.g. MIT.)
