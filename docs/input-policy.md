# Input Sanitization & Stored-HTML Policy (XC-04)

**Owner:** cross-cutting · **Applies to:** every request-body schema and every
server-rendered (non-React) HTML sink in the ERP.

This is the single written rule-set behind the QA-round1 stored-HTML family
(BUG-76 webhook URL, BUG-77 saved-report name, BUG-94 appointment title, and
the broader product/supplier/customer name + notes leak class). The helpers
that encode it live in `erp/src/lib/validators/shared.ts`; the escaping helper
for server-render sinks lives in `erp/src/lib/utils/escape-html.ts`.

## Why this policy exists

React escapes every interpolated value, so raw `<script>` stored in a name or
note field is **inert in the UI** (the CI grep guard below proves there is no
`dangerouslySetInnerHTML` anywhere in `src/`). The real risk is the places where
we build HTML **by hand on the server**: email digests, the PDF/print report
path, receipt and invoice templates, and any future `text/html` response. Those
sinks must escape, and the input schema is the second line of defense for the
field classes where markup is never legitimate.

## The three field tiers

Every string field in a request schema falls into exactly one tier. Use the
shared helper for that tier rather than re-inlining a `z.string()` chain.

### 1. URL fields — `zSafeUrl(maxLen = 2048)`

For webhook URLs, logo/image/media URLs, and any stored link. A URL can never
legally contain `< > " '` or whitespace (RFC 3986), and those are precisely the
markup / attribute-breakout characters. `zSafeUrl` is `z.string().url()` **plus**
a reject of those characters, after trimming.

```ts
webhookUrl: zSafeUrl(),
logoUrl: zSafeUrl().optional().nullable(),
```

### 2. Short identifiers / names — `zSafeShortText(maxLen)`

For report name, product/category/brand name, supplier/customer name — anything
that is a short label and is never markup. `zSafeShortText` trims, requires ≥1
char, caps length, and rejects `< >` and backtick.

```ts
name: zSafeShortText(120),
```

### 3. Free text — `zFreeText(maxLen = 5000)`

For notes, descriptions, `usageInstructions`, `safetyPrecautions`, and other
prose. **Store verbatim; escape on render.** Do **NOT** HTML-encode on store —
encoding would corrupt the Unicode byte-exact round-trips QA verified.
`zFreeText` only bounds length; it is exported as the canonical free-text
schema so later docs reuse it instead of re-inlining `z.string().max(...)`.

```ts
description: zFreeText(2000).optional(),
notes: zFreeText(1000).optional(),
```

## Escape on render, never trust on server-render

The controlling rule: **escaping is the renderer's responsibility, not the
store's.** Any code that assembles an HTML string from data and returns it as
`text/html` (email body, print/PDF page, receipt/invoice template, download
preview) MUST run every interpolated value through `escapeHtml()`
(`erp/src/lib/utils/escape-html.ts`) before it enters the string. This applies
even when the value came from a tier-1/tier-2 field — defense in depth.

Values that are server-generated and structurally safe (e.g. an `INV-YYYY-NNNN`
invoice number, a numeric total, a formatted date) do not require escaping, but
anything traceable to user input does.

## Selective strictness (do NOT blanket-`.strict()`)

Every object schema currently strips unknown keys silently. We deliberately do
**not** add `.strict()` across the board: that would break clients sending
benign extra fields, and the QA chaos tests expect tolerant 2xx/4xx (never a
500). Apply strictness / alias handling **only where a silent key-drop caused
real data loss** — the BUG-19 case (M02-02: product-create accepts a `variants`
alias and rejects other unknown top-level keys). That is the precedent; do not
generalize it.

## CI grep guard

`erp/src/lib/__tests__/no-raw-innerhtml.test.ts` is a fast file-scan test that
fails the suite if `dangerouslySetInnerHTML` appears anywhere under `src/`
outside an (currently empty) allowlist. A legitimate future use must be added
to that allowlist **with a written justification** in the test file. This keeps
the "React UI is safe" premise honest.

## Member rollout (later waves)

The shared helpers and this policy land now; the individual member routes adopt
them in their own waves and flip their spec pins to 400 on markup:

- BUG-76 (M33-01) webhook URL → `zSafeUrl()` — W7
- BUG-77 (M34-02) saved-report name → `zSafeShortText()` — W9
- BUG-94 (M27-07) appointment title/notes → `zSafeShortText()` / `zFreeText()` — W9

Until those waves run, the helpers are available and tested but not yet wired
into those routes.
