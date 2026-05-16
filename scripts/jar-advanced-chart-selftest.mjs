#!/usr/bin/env node
/**
 * Advanced Jar chart model — manual QA checklist + reminder to run typecheck.
 * Math self-test runs in __DEV__ when the app loads jarAdvancedChartModel.ts.
 */
console.log('Advanced Jar balance chart — manual QA checklist\n');
const items = [
  'Open Settings → Jar → Configure Advanced Jar → pick an asset.',
  'Default ceiling knot: edit ceiling amount and default split; save.',
  'Add 2–3 milestones on the balance chart; verify one colored line per pocket in the rules.',
  'Slide on the track: preview bar updates; caption says “Preview … (automatic)”.',
  'Tap a milestone knot: edit split below; save.',
  'Jar screen: distribute matches preview at current Jar balance for that asset.',
  'Import/export backup still unrelated — no regression on Settings save.',
];
items.forEach((t, i) => console.log(`${i + 1}. ${t}`));
console.log('\nRun: npm run typecheck:src');
