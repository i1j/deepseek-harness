# Agent Note: Deep Sea dark palette as a first-class theme

Status: implemented

English | [中文](2026-08-14-deep-sea-theme.zh.md)

## Problem

Dark mode was one generic palette: every surface shared the same gray tones, so nothing encoded how important a piece of information was. The user asked for a "deep sea world" design whose basic logic is letting people attend to what matters by brightness — chrome should sink into the dark, the conversation should be the lit reading area, and text, meta, and accents should form a visible hierarchy. The pre-PR fix lived as a hardcoded CSS override injected by the conversation plugin: it could not persist, could not surface in Settings, and was overwritten by any package upgrade.

## Decision

**Deep Sea is a registered built-in theme.** The ui-theme registry gains a `deep-sea` entry — `colorScheme: 'dark'`, dark-only by construction — as a single 94-token alias override layer (`deep-sea.ts`) re-skinning backgrounds, borders, labels, states, buttons, and the shiki syntax palette.

**It persists and is selectable.** `THEME_PREFERENCES` and the Host settings schema extend with `'deep-sea'` so the preference writes through the existing settings scope; the Appearance row grows a fourth cube (a dark-sea swatch with a bioluminescent cyan mote); the pre-plugin boot script maps `deep-sea` to the dark scheme exactly like `dark`.

**Theme-scoped styles key off a presenter mirror.** The ui-layout theme presenter now mirrors the active theme id as `data-ds-theme` on `body`, so component styles scope to the theme: conversation markdown tiers (headings sink to steel blue `rgb(100,128,168)`, strong glows `rgb(146,180,222)`, inline code is sea-glass cyan `rgb(94,192,226)`, h6 stays gray), the conversation reading-area background rises to `rgb(28,35,49)`, and the sidebar label tier dims to `rgb(158,170,196)`.

**Brightness encodes hierarchy (L0–L4).** Chrome recedes into the dark sea (base `rgb(10,14,22)`, sidebar `rgb(9,13,21)`), the conversation column is the lit reading area, body text is the brightest bioluminescent soft-white, meta dims through secondary/tertiary/caption, and accents are fluorescent deep-sea colors (cyan primary, green success, amber warn, coral error).

## Alternatives considered

**A hardcoded CSS override injected by the conversation plugin.** Rejected: that was the pre-PR patch form — it could not be selected or persisted, lived outside the theme system, and was overwritten by package upgrades.

**A separate palette system.** Rejected: the ui-theme registry already supports token layers, so a new mechanism would duplicate it with no user-visible gain.

## Consequences

Light mode is untouched — the palette is dark-only by construction, and choosing Deep Sea forces the dark scheme even for light users. Component-level deep-sea styling is keyed on the presenter-owned `data-ds-theme` attribute, so a future theme gets the same scoping seam without new plumbing. The 94-token layer is the single place to tune the palette, and brand, button, and state surfaces take the fluorescent deep-sea colors in dark mode.
