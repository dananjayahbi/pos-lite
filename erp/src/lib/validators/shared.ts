import { z } from 'zod';

/**
 * INF-04 — shared validator primitives.
 *
 * `zPrice`: money input contract for request bodies — accept string-or-number,
 * finite, at most 2 decimal places, non-negative unless `allowNegative`.
 * Output is a JS number (services pass it straight to Prisma Decimal fields).
 * Reused by M03-05 (commission), M15-02 (promotion value), M27-07 (price max),
 * and the XC-01 query coercion path.
 */

const DECIMAL_2DP_RE = /^-?\d+(\.\d{1,2})?$/;

export function zPrice(opts: { allowNegative?: boolean } = {}) {
  return z
    .union([z.string().trim(), z.number()])
    .refine(
      (v) => {
        const s = String(v);
        if (s.trim() === '' || s === 'NaN' || s === 'Infinity' || s === '-Infinity') return false;
        if (!DECIMAL_2DP_RE.test(s)) return false;
        const n = Number(s);
        if (!Number.isFinite(n)) return false;
        if (!opts.allowNegative && Object.is(n, -0)) return false;
        return opts.allowNegative ? true : n >= 0;
      },
      opts.allowNegative
        ? 'Must be a number with at most 2 decimal places'
        : 'Must be a non-negative number with at most 2 decimal places',
    )
    .transform((v) => Number(String(v)));
}

/**
 * XC-04 — input sanitization / stored-HTML policy primitives.
 * See docs/input-policy.md for the three-tier rule this encodes:
 *   URL fields        -> zSafeUrl()       (reject RFC-3986-illegal chars)
 *   short identifiers -> zSafeShortText() (never markup: no < > `)
 *   free text         -> zFreeText()      (store verbatim, escape on render)
 */

/** Characters that can never legally appear in a URL (RFC 3986) and are the
 *  building blocks of HTML markup / attribute-breakout. */
const ILLEGAL_URL_CHARS_RE = /[<>"'\s]/;

/**
 * URL schema for webhook/logo/image/media URL fields: a valid URL that also
 * rejects `< > " '` and whitespace (RFC-3986-illegal), so stored URLs can
 * never carry markup or quote-breakout payloads. Input is trimmed first;
 * internal whitespace is rejected (a space is not valid in a URL).
 */
export function zSafeUrl(maxLen = 2048) {
  return z
    .string()
    .trim()
    .min(1)
    .max(maxLen)
    .url('Must be a valid URL')
    .refine(
      (v) => !ILLEGAL_URL_CHARS_RE.test(v),
      'URL contains illegal characters (<, >, ", \', whitespace)',
    );
}

/** Markup characters that short identifiers/names must never contain. */
const SHORT_TEXT_MARKUP_RE = /[<>`]/;

/**
 * Short identifier/name schema (report name, product/category/brand name,
 * supplier/customer name): trims, requires ≥1 char after trim, caps length,
 * and rejects `< >` and backtick — short names are never markup.
 */
export function zSafeShortText(maxLen: number) {
  return z
    .string()
    .trim()
    .min(1)
    .max(maxLen)
    .refine(
      (v) => !SHORT_TEXT_MARKUP_RE.test(v),
      'Must not contain < > or ` characters',
    );
}

/**
 * Canonical free-text schema (notes, descriptions, usageInstructions,
 * safetyPrecautions): store VERBATIM, escape on render. NO HTML-encoding on
 * store — encoding would corrupt the Unicode byte-exact round-trips QA
 * verified. This schema exists only to bound length and to be the named,
 * greppable expression of the "escape on render, never trust on
 * server-render" rule; later docs must reuse it instead of re-inlining
 * `z.string().max(...)`.
 */
export function zFreeText(maxLen = 5000) {
  return z.string().max(maxLen);
}

/**
 * M14-03 (req 2.2) — Sri Lankan mobile phone contract shared by customers
 * (create/update) and suppliers. Semantics extend the long-standing
 * `SL_PHONE_REGEX` (`^(\+94\d{9}|07\d{8})$`) that Module 06 verified:
 *
 *  - separators (spaces, dashes, dots, parentheses) are stripped first, so
 *    "+94 77 123 4567" / "077-123-4567" are accepted;
 *  - the canonical form must then match `pattern` — by default
 *    `+94XXXXXXXXX` or the local/trunk form `0XXXXXXXXX` (0 + 9 digits,
 *    covering the 06/07/09 mobile ranges); anything else is rejected with a
 *    message naming the expected format;
 *  - with `normalize` (default true) the local form is rewritten to
 *    `+94XXXXXXXXX` E.164-ish form for storage. Because
 *    `@@unique([tenantId, phone])` is a raw string uniqueness rule, this
 *    normalization is what unifies the `077…`/`+9477…` duplicate-phone hole
 *    (the same number entered both ways used to create two rows). Suppliers
 *    pass `normalize: false` to preserve the verbatim storage contract the
 *    Module 06 QA suite pins (their service layer re-checks the raw value).
 *
 * Validation applies on create/update input only — existing rows with
 * legacy formats are never rewritten or re-validated on read.
 */
const PHONE_SEPARATORS_RE = /[\s\-().]/g;
const SL_PHONE_LOCAL_RE = /^(\+94\d{9}|0\d{9})$/;

export function zSriLankaPhone(
  opts: { message?: string; normalize?: boolean; pattern?: RegExp } = {},
) {
  const pattern = opts.pattern ?? SL_PHONE_LOCAL_RE;
  const normalize = opts.normalize ?? true;
  const message =
    opts.message ?? 'Enter a valid Sri Lankan mobile number (+94XXXXXXXXX or 0XXXXXXXXX)';
  return z
    .string()
    .trim()
    .min(1, 'Phone is required')
    .max(20)
    .transform((raw, ctx) => {
      const digits = raw.replace(PHONE_SEPARATORS_RE, '');
      if (!pattern.test(digits)) {
        ctx.addIssue({ code: 'custom', message });
        return z.NEVER;
      }
      // 0XXXXXXXXX → +94XXXXXXXXX; already-+94 values pass through untouched.
      return normalize && digits.startsWith('0') ? `+94${digits.slice(1)}` : digits;
    });
}
