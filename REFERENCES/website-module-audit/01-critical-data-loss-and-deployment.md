# 01 — Critical: Data Loss & Deployment Risks

This document covers the issues that cause data to be silently lost or that will break the website module in a fresh production deployment. Fix these first.

---

## Finding 1.1 — Hero slide edits are silently discarded (root cause of "sections not updating")

**Severity:** Critical
**Area:** ERP Website Configuration form → config save path

### Symptom
When an admin edits the **Hero Banner / hero slides** on the **Landing Page** tab and saves, the changes do not appear on the customer website, and after reloading the editor the hero slides revert to their previous state.

### Root cause
- The Landing Page tab edits hero slides as part of the **in-memory website config object** (an embedded `heroSlides` array) and sends the whole config object through the main "save website settings" request.
- The request body is validated against the website config schema, which **does not declare `heroSlides` (nor `ads`, nor a `removedSlideIds` tracking field)**. The validation layer strips any fields it does not recognize, so those arrays are removed before anything is written to the database.
- Separately, the customer-facing website does **not** read hero slides from the config JSON at all — it reads them from dedicated hero-slide database rows returned by the public config endpoint.
- Therefore the editor is displaying and editing a value that is dropped on save, while the storefront reads a value that the editor never writes. The two sources are disconnected.

### Impact
Hero-slide edits are lost every time. Uploaded hero-slide images are uploaded to Cloudflare and then orphaned because their URLs live in the stripped array. The storefront continues to show whatever was in the dedicated rows (or nothing).

### Supporting context
- Dedicated hero-slide API routes exist and are internally correct (they write rows and trigger storefront revalidation), but **no component in the current UI calls them** — the only component that ever did is orphaned and unused.
- A code comment in the form claiming hero slides are "embedded in the config" is inaccurate; no JSON field stores them.

### Recommended fix direction
Pick ONE source of truth and make the editor use it end-to-end:
- Option A (recommended): Have the Landing Page hero editor call the dedicated hero-slide create/update/delete API routes instead of mutating the config object, and reload from those routes on mount. Remove the embedded `heroSlides`/`removedSlideIds` fields from the save payload.
- Option B: Add `heroSlides`/`ads` as validated fields in the config schema, persist them into the JSON config, and make the storefront read them from there — then remove or stop using the separate rows.

---

## Finding 1.2 — "Reset to Defaults" button is broken

**Severity:** Critical
**Area:** ERP Website Configuration form → Reset action

### Symptom
Clicking **Reset to Defaults** always fails with "Failed to reset configuration"; the config is never cleared.

### Root cause
The Reset action issues a delete request to the website config API route, but that route **only implements read and update handlers — it has no delete handler**. The request is rejected with "method not allowed", which the form treats as a failure.

### Impact
Admins cannot reset a tenant's website configuration. There is also no service function to clear the config even if a handler were added.

### Supporting context
- Even if a delete handler were added, it would only clear the config row's JSON; it would not cascade to the related hero-slide and ad rows, so those would survive a reset.

### Recommended fix direction
Add a delete handler on the config route backed by a reset service that clears the config JSON (and, by design decision, the related hero slides / ads rows). Then have the form re-run the load and revalidation after reset.

---

## Finding 1.3 — Website database tables are missing from the migration history

**Severity:** Critical (deployment / data integrity)
**Area:** Prisma schema vs migrations

### Symptom
The website module works in environments where the database was created with an ad-hoc schema push, but a **fresh deployment built from the migration history will fail** with "relation does not exist" errors for the website tables.

### Root cause
The Prisma schema defines three models — website config, website hero slide, and website ad — **but none of the checked-in migration files create these tables**. The migration history only covers tenants, categories, products, variants, stock, notifications, audit logs, payments, and returns. The schema and the migration set are out of sync.

### Impact
In CI / production where migrations are applied from scratch (standard deployment), the website tables are never created, so every website-config query at runtime errors and the module is fully non-functional. It also means the schema cannot be reliably reproduced on a new environment.

### Supporting context
- All JSON columns in these models are non-nullable with sensible database defaults, so once the tables exist, inserts are safe; the migration problem is the only blocker.
- The seed script creates tenants but **does not seed any website config, hero slides, or ads**, so a fresh tenant has no config until created.

### Recommended fix direction
Generate a new migration that creates the three website tables (and any indexes/relations), and verify that a from-scratch migration apply succeeds. Consider whether the seed should also create a default website config for each tenant.

---

## Finding 1.4 — Load vs save mismatch for hero slides and ads

**Severity:** Medium (companion to 1.1)
**Area:** Website config read vs write

### Symptom
When the editor loads the website config, it receives the hero slides and ads as related rows. When it saves, those fields are stripped. The result is that **what is loaded is not what is saved**, so the UI shows state that cannot be persisted.

### Root cause
The read path returns related hero-slide/ad rows appended to the config; the write path uses a schema that does not accept those fields.

### Recommended fix direction
After choosing a single source of truth (see 1.1), ensure the load and save paths agree on whether hero slides and ads are separate rows (managed via their own APIs) or embedded JSON (managed via the config save).

---

## Finding 1.5 — Deleted hero slides are never acted on

**Severity:** Medium (companion to 1.1)
**Area:** ERP hero-slide deletion

### Symptom
Deleting a hero slide in the Landing Page tab does not actually delete it; it reappears after reload.

### Root cause
The editor records deleted slide IDs in a tracking array that is stripped on save, so the delete intent is never sent to the server. No delete call to the dedicated hero-slide route is made by the current UI.

### Recommended fix direction
When deletion is wired to the dedicated hero-slide API (per 1.1), delete through that API rather than tracking IDs in the config payload.
