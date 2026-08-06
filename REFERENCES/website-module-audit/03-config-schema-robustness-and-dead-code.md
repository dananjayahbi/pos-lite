# 03 — Config Schema, Robustness & Dead Code

This document covers validation gaps, the load/save data-shape mismatch, robustness risks, orphaned components, and preview-shell gaps in the website configuration module.

---

## Finding 3.1 — The `sections` configuration is not validated

**Severity:** Medium (data-integrity)
**Area:** Website config validation schema

### Symptom
Malformed or misspelled section settings can be saved without any warning, and the storefront may then render incorrectly or silently skip a section.

### Root cause
The "sections" part of the website config is validated only as an open map of section name to an arbitrary object. None of the per-section shapes (hero, image slider, best-selling, info ad, categories, latest products, testimonials, store reference, footer) are validated. Typos, wrong value types, or malformed nested structures all pass through and are persisted.

### Impact
- A small typo in a section field (e.g. a wrong image key or wrong product-count type) persists silently and can cause the section to render blank or with wrong content.
- No defensive boundary between the editor and the database for the most complex part of the config.

### Recommended fix direction
Introduce explicit zod schemas for each of the 9 section shapes and validate `sections` against them (with per-key validation). Keep the storefront render resilient to missing keys (it already is), but reject malformed values at save time.

---

## Finding 3.2 — Shallow default merge can erase the 9 section defaults in the editor

**Severity:** Medium (default-missing risk)
**Area:** ERP form load logic

### Symptom
After the editor loads a config that has empty JSON objects (e.g. an empty `sections` map), the nested default sections (hero, image slider, etc.) do not appear, and the admin has no defaults to start from.

### Root cause
When the editor merges the loaded config over its defaults, it does a **shallow** merge for nested objects. If the stored `sections`, social links, or footer columns are empty objects/arrays, they replace the populated defaults rather than being filled in. The database guarantees an empty default (not a populated one), so a tenant that has never edited settings sees an empty editor.

### Supporting context
- The storefront handles this correctly (it fills defaults at render time), but the ERP editor does not.
- Creating a config implicitly (e.g. via a hero-slide POST that auto-creates a config) leaves `sections` empty, compounding this.

### Recommended fix direction
Deep-merge the loaded config over the defaults for the nested JSON structures (sections, social links, footer columns, about values) so missing keys are filled from defaults while saved values are preserved.

---

## Finding 3.3 — Editor form state vs validation schema type mismatch

**Severity:** Medium (maintainability / data-loss risk)
**Area:** ERP types vs validation schema

### Symptom
The editor's data type declares several top-level fields (most notably the hero-slides and ads arrays, and the removed-slide-id tracking field) that the validation schema does not accept. Because the validation layer strips unknown fields, any such field is a silent-loss candidate.

### Root cause
The editor data type and the server validation schema were authored separately and have diverged. Fields present in the type but absent from the schema are silently dropped on save (see Finding 1.1 for the concrete loss).

### Impact
- Continuing to add editor fields without keeping the schema in sync will repeatedly cause silent data loss.
- Hard to reason about which fields actually persist.

### Recommended fix direction
After choosing the single source of truth for hero slides/ads (Finding 1.1), reconcile the editor type with the validation schema so every field the editor exposes is either validated+persisted, or explicitly routed to the dedicated API. Add a test/check that compares the editor fields against the schema keys.

---

## Finding 3.4 — Reset does not clean related rows

**Severity:** Low (companion to Finding 1.2)
**Area:** Reset flow

### Symptom
Even after a proper reset of the website config JSON is implemented, hero slides and ads (stored as related rows) would survive because no cascade cleanup exists for a programmatic reset.

### Root cause
The config row is related to hero slides and ads; a reset that only clears the config row would leave those rows intact.

### Recommended fix direction
Define reset semantics explicitly (clear only JSON, or clear config + slides + ads) and implement accordingly.

---

## Finding 3.5 — Orphaned / dead components in the ERP settings module

**Severity:** Low (maintainability)
**Area:** ERP settings components

### Symptom
Several website-settings components are not imported or used anywhere, so any bugs or divergence in them are invisible and they inflate maintenance surface.

### Root cause
During a refactor, some tab/management components (dedicated hero-slides tab, ads tab, sections tab, navigation tab, testimonials tab) were left behind but are no longer referenced by the main form. They duplicate logic that now lives (partially, and incorrectly) inside the Landing Page tab.

### Impact
- Confusing codebase; two implementations of the same feature (hero slides) that disagree.
- These orphaned components are part of why the hero-slide saving is broken (see Finding 1.1) — the working dedicated routes exist but their UI was orphaned.

### Recommended fix direction
Either wire the dedicated components back into the form (preferred, they already target the correct routes) or delete them, so there is one clear implementation per feature.

---

## Finding 3.6 — ERP preview shell does not render the current section set

**Severity:** Low (UI/preview)
**Area:** ERP website preview

### Symptom
The ERP's live preview of the website config does not show all sections. Notably, the image slider, info ad, and store reference sections never appear in the preview even when enabled, because the preview shell maps only a legacy set of section keys.

### Root cause
The ERP preview component maps section keys to preview components using the old/deprecated key set, which does not include the three current sections. The storefront shell (in the customer website) uses the correct current key set, so the two diverge.

### Impact
Admins cannot visually verify what the storefront will show for those sections, undermining the "what you see is what you get" expectation.

### Recommended fix direction
Align the ERP preview shell's section mapping with the current 9 section keys (and reuse the same section components as the customer website where possible).

---

## Finding 3.7 — Storefront ships several unused section components and an unused brand data helper

**Severity:** Low (dead code)
**Area:** Customer-facing website

### Symptom
The storefront contains section components that are never rendered and a brand-fetch helper that is never called.

### Root cause
- A handful of section components (gift box, promo banner, shop by concern, solutions by concern, stores banner) are not wired into the section registry that decides what renders; they are leftovers from the legacy section set.
- The brand listing helper exists but no page/component uses it.

### Impact
Dead code that is easy to mistake for live functionality; slightly larger bundle and maintenance surface.

### Recommended fix direction
Remove the unused section components and the brand helper, or wire them in if they are intended features.

---

## Finding 3.8 — Schema comment lists an outdated section key set

**Severity:** Info
**Area:** Prisma schema

### Symptom
The comment on the website config model's sections field lists section keys (solutions by concern, shop by concern, gift box, promo banner, stores banner) that are no longer the current set.

### Root cause
The comment was not updated during the section-set refactor; the schema field itself is just a JSON blob, so the code that interprets it lives elsewhere.

### Impact
Misleading documentation; a reader may assume legacy keys are supported.

### Recommended fix direction
Update the comment to reference the current section key set (and ideally a shared constant so it cannot drift).

---

## Finding 3.9 — Seed creates no website configuration for tenants

**Severity:** Info (companion to Finding 1.3)
**Area:** ERP seed

### Symptom
New tenants seeded for development have no website config, hero slides, or ads, so the storefront renders empty until configured.

### Root cause
The seed script creates tenants but no website-config records.

### Impact
- Fresh dev environments show an empty storefront.
- Provides no baseline default sections to verify rendering.

### Recommended fix direction
Optionally seed a default website config (with the 9 section defaults) for each seeded tenant to make development and preview representative.
