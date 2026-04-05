#!/usr/bin/env node
/**
 * Tarcak security gate: dependency audit + static checks for patterns that often enable
 * supply-chain abuse, injection, or unsafe dynamic code. Intended for CI and local runs.
 *
 * Env:
 *   SECURITY_AUDIT_ALL=1  — also fail on moderate (stricter than default high/critical).
 *   SECURITY_SKIP_AUDIT=1 — skip npm audit (e.g. offline).
 */

import { readFileSync, readdirSync, statSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { spawnSync } from 'child_process';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');

const SCANNABLE_EXT = /\.(ts|tsx|js|jsx|mjs|cjs)$/;

/** Paths relative to ROOT; only these trees/files are scanned for forbidden patterns. */
const SCAN_TARGETS = ['src', 'AppBoot.tsx', 'App.tsx', 'index.ts'];

const FORBIDDEN = [
  { re: /\beval\s*\(/, name: 'eval()' },
  { re: /\bnew\s+Function\s*\(/, name: 'new Function()' },
  { re: /\bFunction\s*\(\s*['"`]/, name: 'Function("...") constructor' },
  { re: /\bchild_process\b/, name: 'Node child_process' },
  { re: /\brequire\s*\(\s*['"]child_process['"]\s*\)/, name: 'require("child_process")' },
  { re: /\bexecSync\s*\(/, name: 'execSync()' },
  { re: /\bexecFileSync\s*\(/, name: 'execFileSync()' },
  { re: /\bspawnSync\s*\(/, name: 'spawnSync()' },
  { re: /\bdangerouslySetInnerHTML\b/, name: 'dangerouslySetInnerHTML' },
  { re: /\.innerHTML\s*=/, name: '.innerHTML assignment' },
  { re: /\bdocument\.write\s*\(/, name: 'document.write()' },
];

function* walkDir(dir, base = dir) {
  let names;
  try {
    names = readdirSync(dir);
  } catch {
    return;
  }
  for (const name of names) {
    if (name === 'node_modules' || name === '.git' || name === 'dist' || name === 'build') {
      continue;
    }
    const full = join(dir, name);
    let st;
    try {
      st = statSync(full);
    } catch {
      continue;
    }
    if (st.isDirectory()) {
      yield* walkDir(full, base);
    } else if (SCANNABLE_EXT.test(name)) {
      yield full;
    }
  }
}

function collectFiles() {
  const files = new Set();
  for (const target of SCAN_TARGETS) {
    const abs = join(ROOT, target);
    if (!existsSync(abs)) {
      continue;
    }
    const st = statSync(abs);
    if (st.isFile() && SCANNABLE_EXT.test(target)) {
      files.add(abs);
    } else if (st.isDirectory()) {
      for (const f of walkDir(abs)) {
        files.add(f);
      }
    }
  }
  return [...files].sort();
}

function scanStatic() {
  const files = collectFiles();
  const hits = [];
  for (const file of files) {
    let content;
    try {
      content = readFileSync(file, 'utf8');
    } catch {
      continue;
    }
    const lines = content.split(/\r?\n/);
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (line.trim().startsWith('//') || line.trim().startsWith('*')) {
        continue;
      }
      for (const { re, name } of FORBIDDEN) {
        if (re.test(line)) {
          hits.push({
            file: file.replace(/\\/g, '/').replace(ROOT.replace(/\\/g, '/'), '').replace(/^\//, ''),
            line: i + 1,
            rule: name,
            preview: line.trim().slice(0, 120),
          });
        }
      }
    }
  }
  return hits;
}

function runNpmAudit() {
  if (process.env.SECURITY_SKIP_AUDIT === '1') {
    console.log('[security-scan] Skipping npm audit (SECURITY_SKIP_AUDIT=1).\n');
    return true;
  }

  const npmCmd = process.platform === 'win32' ? 'npm.cmd' : 'npm';
  const auditLevel = process.env.SECURITY_AUDIT_ALL === '1' ? 'moderate' : 'high';

  const prod = spawnSync(npmCmd, ['audit', '--omit=dev', `--audit-level=${auditLevel}`], {
    cwd: ROOT,
    encoding: 'utf8',
    shell: process.platform === 'win32',
  });

  if (prod.status !== 0) {
    console.error('[security-scan] npm audit (production dependencies) failed.\n');
    console.error(prod.stdout || '');
    console.error(prod.stderr || '');
    console.error(
      `\nFix or document accepted risk. Stricter check: SECURITY_AUDIT_ALL=1. Skip: SECURITY_SKIP_AUDIT=1.\n`
    );
    return false;
  }

  console.log(`[security-scan] npm audit --omit=dev --audit-level=${auditLevel}: OK\n`);

  const all = spawnSync(npmCmd, ['audit', `--audit-level=${auditLevel}`], {
    cwd: ROOT,
    encoding: 'utf8',
    shell: process.platform === 'win32',
  });

  if (all.status !== 0) {
    console.warn('[security-scan] Warning: devDependencies report issues (production deps are clean):');
    console.warn(all.stdout || all.stderr || '(no output)');
    console.warn('');
  }

  return true;
}

function main() {
  console.log('Tarcak security scan\n' + '='.repeat(40) + '\n');

  const staticHits = scanStatic();
  if (staticHits.length > 0) {
    console.error('[security-scan] Forbidden patterns in application source:\n');
    for (const h of staticHits) {
      console.error(`  ${h.file}:${h.line}  ${h.rule}`);
      console.error(`    ${h.preview}\n`);
    }
    console.error(
      'These patterns often enable code injection, XSS, or RCE. Remove them or justify in review.\n'
    );
    process.exit(1);
  }
  console.log('[security-scan] Static pattern scan: OK (no forbidden constructs in src/).\n');

  if (!runNpmAudit()) {
    process.exit(1);
  }

  console.log('[security-scan] All checks passed.\n');
  process.exit(0);
}

main();
