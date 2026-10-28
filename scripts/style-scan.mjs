#!/usr/bin/env node
/**
 * Tarcak style gate: static checks for the rules in DESIGN.md that a type check cannot see.
 * Runs offline; `scripts/check.sh` runs it next to the type check.
 *
 *   raw hex          colours come from useAppTheme() (the palettes and the chart palette are the only places for hex)
 *   colour literals  rgba() and named colours
 *   font family      only `font.*` from src/theme/fonts.ts, never a literal family
 *   font size        12 and up (DESIGN.md type scale)
 *   layout animation only through animateNextLayout(), which honours Reduce Motion
 *   hit slop         only the HIT_SLOP constant, so small controls reach 48 dp the same way everywhere
 *
 * A line can opt out with `// style-ok: <reason>`.
 */

import { readFileSync, readdirSync, statSync, existsSync } from 'fs';
import { join, dirname, relative } from 'path';
import { fileURLToPath } from 'url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SCAN_TARGETS = ['src', 'AppBoot.tsx', 'App.tsx'];
const SCANNABLE_EXT = /\.(ts|tsx)$/;

/** Files that define colours or the helper a rule points to. Paths are relative to ROOT. */
const HEX_ALLOWED = ['src/theme/', 'src/utils/pocketChartColors.ts'];
const FONT_ALLOWED = ['src/theme/'];
const ANIMATE_ALLOWED = ['src/utils/animateLayout.ts'];
const SLOP_ALLOWED = ['src/utils/hitSlop.ts'];

const MIN_FONT_SIZE = 12;

const RULES = [
  {
    name: 'raw hex colour (use useAppTheme())',
    re: /#[0-9a-fA-F]{6}\b|#[0-9a-fA-F]{3}\b(?![0-9a-fA-F])/,
    allowed: HEX_ALLOWED,
    // A hex inside a string that is not a colour (an issue number, an anchor) is not worth a rule; colours are quoted.
    only: /['"`]#[0-9a-fA-F]{3,8}['"`]/,
  },
  {
    name: 'colour literal (use useAppTheme())',
    re: /\brgba?\(|(?:color|backgroundColor|borderColor)\w*:\s*['"](?:white|black|red|green|blue|gray|grey|orange|yellow|purple|pink|transparent)['"]/,
    allowed: ['src/theme/'],
    // `transparent` is not a theme colour, it is the absence of one.
    skip: /:\s*['"]transparent['"]/,
  },
  {
    name: 'literal font family (use font.* from src/theme/fonts.ts)',
    re: /fontFamily:\s*['"`]/,
    allowed: FONT_ALLOWED,
  },
  {
    name: `font size below ${MIN_FONT_SIZE}`,
    test: (line) => {
      const m = /fontSize:\s*(\d+(?:\.\d+)?)/.exec(line);
      return m && Number(m[1]) < MIN_FONT_SIZE;
    },
    allowed: [],
  },
  {
    name: 'LayoutAnimation (use animateNextLayout())',
    re: /\bLayoutAnimation\b/,
    allowed: ANIMATE_ALLOWED,
  },
  {
    name: 'numeric hitSlop (use HIT_SLOP)',
    re: /hitSlop=\{\s*(?:\d|\{)/,
    allowed: SLOP_ALLOWED,
  },
];

function* walk(dir) {
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules' || name === '.git') continue;
    const full = join(dir, name);
    const st = statSync(full);
    if (st.isDirectory()) yield* walk(full);
    else if (SCANNABLE_EXT.test(name)) yield full;
  }
}

function files() {
  const out = [];
  for (const t of SCAN_TARGETS) {
    const abs = join(ROOT, t);
    if (!existsSync(abs)) continue;
    if (statSync(abs).isDirectory()) out.push(...walk(abs));
    else out.push(abs);
  }
  return out.sort();
}

function isAllowed(rel, allowed) {
  return allowed.some((a) => (a.endsWith('/') ? rel.startsWith(a) : rel === a));
}

const hits = [];
for (const file of files()) {
  const rel = relative(ROOT, file).replace(/\\/g, '/');
  const lines = readFileSync(file, 'utf8').split(/\r?\n/);
  lines.forEach((line, i) => {
    const t = line.trim();
    if (t.startsWith('//') || t.startsWith('*') || t.startsWith('/*') || line.includes('style-ok:')) return;
    for (const rule of RULES) {
      if (isAllowed(rel, rule.allowed)) continue;
      if (rule.skip?.test(line)) continue;
      const hit = rule.test ? rule.test(line) : rule.re.test(line) && (!rule.only || rule.only.test(line));
      if (hit) hits.push({ rel, line: i + 1, rule: rule.name, preview: t.slice(0, 110) });
    }
  });
}

console.log('Tarcak style scan\n' + '='.repeat(40) + '\n');
if (hits.length > 0) {
  console.error('[style-scan] Style rules broken (see DESIGN.md):\n');
  for (const h of hits) {
    console.error(`  ${h.rel}:${h.line}  ${h.rule}`);
    console.error(`    ${h.preview}\n`);
  }
  console.error('Fix them, or mark a justified line with `// style-ok: <reason>`.\n');
  process.exit(1);
}
console.log('[style-scan] OK\n');
