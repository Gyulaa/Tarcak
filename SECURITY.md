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

## Automated security scan

The repo runs a **security gate** on push/PR to `main`/`master` and weekly (see [.github/workflows/security.yml](.github/workflows/security.yml)):

1. **`npm audit`** on **production** dependencies (`--omit=dev`), failing the job on **high** or **critical** advisories by default. Dev-only issues are reported as a warning if production is clean.
2. **Static pattern scan** ([`scripts/security-scan.mjs`](scripts/security-scan.mjs)) over `src/` and root app entry files. It flags common foot-guns: `eval`, dynamic `Function`, Node `child_process` / `execSync` / `spawnSync`, `dangerouslySetInnerHTML`, and `innerHTML` assignment. The app is React Native / local-first; these patterns rarely belong in shipped code.

**Local run:** `npm run security:scan`

**Environment variables:** `SECURITY_AUDIT_ALL=1` treats moderate npm issues as failures. `SECURITY_SKIP_AUDIT=1` skips npm audit (e.g. air-gapped).

**Limits:** This does not prove absence of bugs, malicious dependencies that pass audit, or social engineering. **Malicious “agents”** (compromised maintainer accounts, typosquat packages, prompt-injected tooling) are mitigated partly by audit + review, not eliminated. Prefer pinning versions, reviewing lockfile diffs, and using GitHub **dependency review** on PRs (enabled in the same workflow for PRs).

**Reporting:** Use [GitHub Security Advisories](https://github.com/Gyulaa/Tarcak/security/advisories/new) for sensitive findings, not public issues.
