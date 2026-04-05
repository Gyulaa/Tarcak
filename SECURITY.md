# Security

## Reporting vulnerabilities

If you believe you found a security bug in Tarcak, please **do not** open a public GitHub issue with exploit details. Instead, report privately via **[GitHub Security Advisories](https://github.com/Gyulaa/Tarcak/security/advisories/new)** for [Gyulaa/Tarcak](https://github.com/Gyulaa/Tarcak) (enable the Security tab / Advisories in repo settings if needed), or another non-public channel listed on the maintainer profile.

Include: affected platform (iOS / Android / version), steps to reproduce, and impact. We will treat valid reports seriously.

## Cryptography notes for contributors

- **PBKDF2 iteration count** is stored in SecureStore when a vault is created or when the user changes their password (`tarcak_v1_pbkdf2_iterations`). Unlock uses the **stored** value so changing `PBKDF2_ITERATIONS` in `src/security/constants.ts` does not break existing installs that already have this key.
- Vaults created **before** that key existed fall back to the current `PBKDF2_ITERATIONS` constant on unlock. If you previously shipped a different default iteration count and never stored it, those users may be unable to unlock after you change the constant unless they still match that historical value — **avoid lowering or changing iterations without a migration strategy** for those edge cases.
- The app is **local-first**: there is no server-side account recovery. A forgotten password means **local erase** (user-initiated) and a new vault.

## Threat model (short)

See the main [README.md](README.md) security section. This project does not claim protection against malware on a compromised device, kernel-level attackers, or shoulder surfing.
