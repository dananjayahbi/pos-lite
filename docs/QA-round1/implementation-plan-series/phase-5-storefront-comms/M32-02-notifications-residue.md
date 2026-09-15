# M32-02 — OBS-57/58/59/60/61: notification-center residue (centralized page gate, icon coverage, one-way read-state, unbounded read-all)

**Severity:** P3 bundle (polish + one durability note) · **Module:** 32 Notifications · **QA refs:** OBS-57…61 · **Depends on:** nothing (independent small items)

## Verified source state (2026-09-15)
1. **OBS-57:** `/notifications` is a `'use client'` page relying on middleware for the auth redirect (works today: unauth → `/login?callbackUrl=/notifications`), so the defense is centralized — fine, but any future middleware public-path registration would expose the shell. Low risk; note only.
2. **OBS-58:** all 260 live rows target one recipient (dilani owner) — per-role targeting is producer-driven and structurally satisfied; only exercised for OWNER. Test-fixture note, not a defect.
3. **OBS-59:** `NotificationType` enum has 20 values; UI `TYPE_ICONS` map covers 6 — missing types fall back to a default icon (no crash). Cosmetic coverage gap.
4. **OBS-60:** read-state is one-way (unread→read); no "mark as unread" API — QA had to reset read-state in the DB between runs (consumes the unread fixture pool permanently).
5. **OBS-61:** `read-all` uses `updateMany` with no limit — a single unbounded write; fine at 260 rows, risky at production volume.

## Fix approach (small, low-risk)
- **OBS-59:** complete the `TYPE_ICONS` map for all 20 enum values (or confirm the default-icon fallback is acceptable and just add the missing common ones). Trivial.
- **OBS-60 (optional, product decision):** add a `PATCH /api/notifications/[id]/unread` (toggle `isRead:false`, recipient-scoped, increments unreadCount) — low effort, improves UX and gives QA a fixture-reset path. Flag for client; recommend yes (matches Gmail-style expectation).
- **OBS-61:** batch `read-all` (`updateMany` in chunks of e.g. 500, or a bounded loop) so a huge backlog can't lock the table in one statement. Cheap safety.
- **OBS-57/58:** documentation only — record the centralized-gate assumption in the ROADMAP's test-authoring notes (a public-path change in middleware is a security-sensitive edit).

## Files
- notifications UI icon map, optional unread route + service, read-all batching.

## Acceptance / gate
- `tests/32` F-series/R-series stay green; new unread-toggle test (if adopted) asserts exact unreadCount increment + recipient scoping; read-all still exact-count under a large fixture.
