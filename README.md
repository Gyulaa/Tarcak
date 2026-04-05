# Tarcak

**Repository:** [github.com/Gyulaa/Tarcak](https://github.com/Gyulaa/Tarcak)

Local-first personal finance app: **pockets** (budget segments), **multi-currency balances**, and a **unified ledger** for income, expenses, and transfers between pockets. All data stays on the device and is stored **encrypted**; unlocking the data uses a **password** you choose (not biometrics as the primary secret).

## Current project setup

| Item | Notes |
|------|--------|
| **Runtime** | Expo SDK `~54`, React Native `0.81`, React `19`, TypeScript `strict` |
| **Entry** | `index.ts` → `App.tsx` (fonts) → `AppBoot.tsx` (vault gate + main UI) |
| **Architecture** | New Architecture enabled (`newArchEnabled: true` in `app.json`) |
| **Implemented** | Vault gate, SQLCipher + **migrations `0001`–`0005`**, **repositories** (`pockets`, `transactions`, `settings`, `assetTypes`, `jar`), **Zustand** ledger store, **React Navigation** native stack, screens: **Home** (balances + Jar shortcut when enabled), **Pockets** (Jar row styled distinctly when pool feature on), **Pocket detail**, **transaction editor** (asset type picker, `occurred_at` shown when editing), **History** (pocket filter + **conducted date** per row), **Settings** (default asset type, **Jar on/off**, asset types, lock), **Asset types**, **Jar** (pool balances, distribute, link to split editor), **Jar split** (percentages must total 100%), **encrypted** SQLite |
| **Still to add** | Polish (rename pocket UI, **editable** transaction date), automated tests beyond CI typecheck, optional FX rates |

**UI:** Amounts show **spaced thousands** on the integer part (e.g. `1 000`, `54 333 234`) via `formatIntegerPartWithSpaces` in [`src/utils/amountMinor.ts`](src/utils/amountMinor.ts). **Black (dark) theme** is under **Settings → Appearance**; the flag is `dark_theme_enabled` in `user_settings`.

## Support / donations

Replace the placeholder strings in [`src/constants/donations.ts`](src/constants/donations.ts) with your real **Bitcoin** and **Monero** addresses. On the **Home** screen, a small grey line sits **below the Settings** (and other shortcut) buttons; tapping it opens a sheet with copy-to-clipboard buttons.

The repository [`.github/FUNDING.yml`](.github/FUNDING.yml) points sponsors to this README section (you can add `github: username` there for GitHub Sponsors).

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

**Dependencies:** `expo-secure-store`, `expo-crypto`, `expo-sqlite`, `expo-constants`, `@noble/hashes`, `@noble/ciphers`, `@react-navigation/native`, `@react-navigation/native-stack`, `react-native-screens`, `react-native-safe-area-context`, `react-native-gesture-handler`, `zustand`.

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

**Forgot password:** There is no server reset. The unlock screen offers **“Forgot password? Erase data and start over”**, which deletes the vault (SecureStore) and the local SQLite file so you can **Create vault** with a new password. All previous pockets and transactions on that device are lost unless you add backups later.

---

## Domain concepts

### Pocket

A **pocket** is a user-defined bucket (e.g. “Daily”, “Savings”, “Crypto”). It does not have a single currency: the same pocket can hold **multiple currencies** as separate balances.

### Asset type (currency code)

Each transaction stores a **`currency` string** that must match a row in the **`asset_types`** catalog (code + display name). Users **define** codes (e.g. `HUF`, `USD`, `XMR`) under **Settings → Asset types**, then **pick** them when recording a transaction (no free-text codes on the form). **`default_currency`** in `user_settings` must refer to an existing catalog code.

Amounts are stored as **signed integers**: **one major currency unit = 10⁸ minor units** (8 decimal places), so values like `0.00000001` are exact. **Income / expense** may use negative amounts; **transfers** must be positive (enforced in SQLite and app validation). The UI accepts decimal strings; see `src/utils/amountMinor.ts`. **Never** use floating point for money in logic — only for display derived from integers.

### Jar (pool & distribute)

The vault has **one system pocket** with **`is_jar = 1`** (created by migration `0004`, default name “Jar”). It behaves like any other pocket in the ledger (income, expense, transfers). **Distribution:** the user configures **target pockets and percentages** (basis points summing to **10 000** = 100%) on **Jar split**, then **Distribute** moves the **full** balance of a chosen asset from the Jar into those pockets via **transfer** rows (integer split; remainder on the last target).

**Settings → Pool & distribute** toggles the feature. When **off**, the setting `jar_enabled` is false and the Jar pocket is **`archived = 1`**: it disappears from **Pockets**, **Home** shortcuts, and **new-transaction pocket pickers**, but **balances and history** still count in aggregates. Turning the feature **on** clears archive on the Jar row. `getPocket(id)` still returns archived pockets (e.g. opening the Jar from a disabled-state screen).

### Ledger transactions (single source of truth)

Every user-visible record is a **transaction** row. Balances are **derived** by summing effects per `(pocket_id, currency)` (acceptable for typical personal use; add materialized balance tables later if profiling says you need them).

**Transaction kinds**

| Kind | Meaning | Pockets affected |
|------|---------|------------------|
| `income` | Money in | One **credit** pocket |
| `expense` | Money out | One **debit** pocket |
| `transfer` | Move value between pockets | **Debit** pocket → **credit** pocket (same currency for v1; see below) |

Each record has a **title** (short label), **amount** (non-zero integer in minor units at 10⁻⁸ major), **currency** (must exist in `asset_types`), and **when it happened** (`occurred_at`, Unix ms). New saves set `occurred_at` to the current time; the editor shows the stored value when **editing**. **History** and pocket **recent lists** display this date; the list is ordered by `occurred_at` descending.

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

Known keys include **`default_currency`** (code string) and **`jar_enabled`** (`1` / `0`). When `jar_enabled` is turned off in the app, the Jar pocket is archived in the same write. Price APIs and last-fetched rates can live here or in dedicated tables later.

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
- **Settings:** `getSetting` / `setSetting`, `getDefaultCurrency` / `setDefaultCurrency`, `getJarEnabled` / `setJarEnabled` (also archives/unarchives the Jar).
- **Asset types:** `listAssetTypes`, `createAssetType`, `updateAssetTypeName`, `deleteAssetType`, `currencyExists`, `requireRegisteredAssetCurrency`.
- **Jar:** `listJarDistributionRules`, `replaceJarDistributionRules`, `distributeJarCurrency`, `splitAmountByBps` (pure helper).

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
    keystore.ts          # expo-secure-store accessors
    vault.ts             # create / unlock / change password
    session.ts           # in-memory DEK + AppState listener
    lockdown.ts          # close DB + clear session
    index.ts             # public exports
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
      index.ts           # re-exports
    repositories/
      pockets.ts
      transactions.ts
      settings.ts
      assetTypes.ts
      jar.ts
  domain/
    types.ts
  stores/
    ledgerStore.ts       # zustand: pockets + home balances refresh
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
    SettingsScreen.tsx
    AssetTypesScreen.tsx
    JarScreen.tsx
    JarSplitScreen.tsx
  utils/
    amountMinor.ts
    formatMinor.ts
    formatOccurredAt.ts
AppBoot.tsx              # vault gate (password `TextInput` uses explicit colors on Android release builds) + SafeAreaProvider + MainNavigator when unlocked
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
| Conducted date in UI | `occurred_at` + `formatOccurredAt` in History / pocket detail / editor |
| Filter history by pocket | `listTransactions({ pocketId })` |
| Asset type catalog | `asset_types` + `assetTypes` repository + Settings / editor pickers |
| Jar pool & split distribute | `is_jar` pocket, `jar_distribution_rules`, `jar` repository, Jar / Jar split screens |
| Jar off → archive pocket | `user_settings.jar_enabled` + `pockets.archived` + `setJarEnabled` |
| Encrypted storage | `db/client.ts` + SQLCipher (or equivalent) |
| Password unlock | `security/*` + lock on background |
| Default asset + API prices | `user_settings.default_currency` + optional FX tables later |

---

## Scripts

- `npm start` — Expo dev server  
- `npm run android` / `ios` / `web` — platform targets  

---

## License

(To be chosen when you publish open source, e.g. MIT.)
