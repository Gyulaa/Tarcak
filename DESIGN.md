---
version: alpha
name: "Tarcak"
description: "Local-first, encrypted personal finance app for one person on their own phone: pockets, multi-currency balances and one ledger."
colors:
  primary: "#d45a12"
  on-primary: "#ffffff"
  secondary: "#333333"
  tertiary: "#fff3e8"
  neutral: "#f8f9fa"
  on-neutral: "#111111"
  error: "#b00020"
  success: "#2e7d32"
  neutral-dark: "#0a0a0a"
  on-neutral-dark: "#f0f0f0"
  primary-dark: "#e8702e"
  error-dark: "#ff8a80"
typography:
  display:
    fontFamily: "JetBrains Mono"
    fontSize: "28px"
    fontWeight: 700
  headline:
    fontFamily: "JetBrains Mono"
    fontSize: "20px"
    fontWeight: 600
  body:
    fontFamily: "JetBrains Mono"
    fontSize: "16px"
    fontWeight: 400
    lineHeight: "22px"
  label:
    fontFamily: "JetBrains Mono"
    fontSize: "13px"
    fontWeight: 600
    lineHeight: 1.3
rounded:
  sm: "8px"
  md: "10px"
  lg: "14px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "12px"
  lg: "16px"
  xl: "24px"
components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.on-primary}"
    typography: "{typography.body}"
    rounded: "{rounded.md}"
    padding: "14px"
---

<!-- Compatible with the Google Stitch DESIGN.md format (version alpha). Derived on 2026-10-27 from the existing code, not a new direction: the source of truth is src/theme/ (palette.ts, colorThemes.ts, fonts.ts). The tokens above are the default "terracotta" palette; the other five palettes override the accent tokens only. Values are React Native dp, written as px. -->

## Overview
A quiet, ledger-like tool: one monospace face for everything, neutral grey surfaces, and a single accent colour the user picks. The character comes from the monospace numbers and the user's own palette, not from decoration.

- **Audience and use:** one person, on their own Android or iOS phone, several times a week, to record income, expenses and transfers and check balances.
- **The one action:** record a transaction (and, for the Jar, distribute income into pockets).
- **Mode:** Operate everywhere. The unlock screen is the only standalone surface; it uses the cached palette so it matches the app.
- **Voice:** matter-of-fact, plain English, short labels; informal "you".
- **Off limits:** raw hex colours in screens (use `useAppTheme()`), a second font family, colour as the only carrier of meaning (income/expense also carry a sign or label), anything that suggests the data leaves the device.

## Colors
Semantic tokens live in `AppColors` (`src/theme/palette.ts`): `bg`, `surface`, `surfaceMuted`, `border`, `text`, `textSecondary`, `textMuted`, `primary`, `onPrimary`, `danger`, `success`, plus component tokens (chips, Jar banner, archived pockets, inputs, switches, pocket picker).

Six user-selectable palettes (`COLOR_THEME_ORDER`): `terracotta` (default, shown as "Orange"), `ocean`, `forest`, `slate`, `red`, `yellow`. Each has a light and a dark variant; the dark variant ("Black theme") uses near-black surfaces (`#0a0a0a`, `#141414`) and a lighter accent. Derived palettes change only accent-related tokens; neutrals, text, `danger` and `success` are shared.

Checked contrast (WCAG 2.2 AA, 2026-10-27):
- Pass: `text`, `textSecondary`, `textMuted` on `bg` (≥ 5.4:1 in both themes); `danger` and `success` on `surface`; `primary` as text on `surface` in every dark variant and in light `ocean`, `slate`, `red`.
- **Fail (known debt, `docs/bugs.md` B2):** white `onPrimary` on `primary` is below 4.5:1 in 9 of 12 variants (light: terracotta 3.98, forest 4.08, yellow 3.17; dark: all six, 1.87 to 3.44). Only light ocean, slate and red pass. Selected pocket-picker text also fails on light forest (1.85), yellow (1.91), red (2.75), ocean (2.85). `placeholder` on light inputs is 2.2:1.
- Rule for new work: a new or changed palette must reach 4.5:1 for `onPrimary` on `primary`; in dark variants that usually means a dark `onPrimary`, not a lighter accent.

## Typography
JetBrains Mono only (`@expo-google-fonts/jetbrains-mono`, SIL OFL, bundled with the app, no network fetch). `applyJetBrainsMonoDefaults()` sets Regular on every `Text` and `TextInput`; SemiBold and Bold are set explicitly with `font.semibold` / `font.bold`. The monospace face keeps amounts aligned without tabular-figure settings.

Scale in use (most to least frequent): 16 (body, inputs), 13 and 14 (labels, secondary rows), 15, 18, 12 (captions), 17, 20 to 22 (screen and section titles), 24 to 28 (balance totals). Line height is mostly the React Native default; where set, multi-line body text uses 22 (on 16) and 20 for smaller text. Amounts are formatted with spaced thousands (`formatIntegerPartWithSpaces`).

## Layout
Single column, portrait only, screens inside `ScreenWithFooter`. Spacing steps in use: 4, 6, 8, 10, 12, 14, 16, 20, 24; the common rhythm is 16 screen and card padding, 8 to 12 between rows, 6 to 10 inside groups. New code picks from the token steps above (4, 8, 12, 16, 24) unless it sits next to an existing odd value.

## Elevation & Depth
Hierarchy comes from surface steps (`bg` → `surface` → `surfaceMuted`) and 1px `border` / `borderStrong` lines. Shadow is rare (three places, `elevation: 2`), mainly the Jar card tinted with `shadowJar`. Modals dim the screen with `modalOverlay`.

## Shapes
Radii in use: 8 (chips, small controls), 10 (buttons, inputs, the most common), 12 and 14 (cards, sheets), 16 to 20 (pills, large cards). Nested elements use a smaller radius than their container.

## Components
- **Buttons:** filled `primary` with `onPrimary` text for the main action; secondary actions as bordered or text buttons. Disabled and pressed states lower opacity (0.45 is the common disabled value).
- **`ModalSelectField`:** the one select pattern everywhere, including multi-select filter sheets (tap toggles a checkmark and keeps the sheet open; "All" clears and closes).
- **Collapsible filter / settings panels** (History, Statistics): summary chips (`chipBg` / `chipText`) when collapsed.
- **Pocket picker rows:** `pocketPick*` tokens; selected state uses border and text colour.
- **Charts:** `react-native-gifted-charts`, value readout in a fixed row above the chart (no floating tooltip; Android ScrollView clips overflow).
- **Switches:** `switchTrack*` / `switchThumb*` tokens, never the platform default colours.

## Do's and Don'ts
- Do: take every colour from `useAppTheme()`; add a new token to `AppColors` and to all six palettes in both variants in the same change, and list it here.
- Do: show amounts in the monospace face with spaced thousands and an explicit sign or kind label.
- Don't: add a second typeface, gradients on content, or decorative motion.
- Don't: ship a palette or token pair below AA contrast (see Colors).

## Motion
Almost none, by intent. The collapsible filter and settings panels animate with `LayoutAnimation.Presets.easeInEaseOut`; everything else changes instantly. Native-stack navigation uses the platform transitions. Reduced-motion handling is not implemented yet; new motion must respect it (`AccessibilityInfo.isReduceMotionEnabled`).

## Platforms
Expo / React Native, Android first (also iOS). Navigation, back gesture and stack transitions follow the platform (`@react-navigation/native-stack`); colours, type and shapes are the app's own. Theme code: `src/theme/palette.ts` (token type), `colorThemes.ts` (palettes), `ThemeContext.tsx` (`useAppTheme()`), `appearanceCache.ts` (palette mirrored to SecureStore for the unlock screen), `fonts.ts` and `applyGlobalFont.ts`.
