/**
 * XC-04 — unit tests for the shared input-sanitization helpers in
 * `src/lib/validators/shared.ts` (zSafeUrl / zSafeShortText / zFreeText).
 * These pin the three-tier policy from docs/input-policy.md:
 * URLs reject RFC-3986-illegal markup chars, short text rejects markup,
 * free text is stored VERBATIM (no over-sanitization — Unicode and `<script>`
 * round-trip byte-exact; escaping is the renderer's job).
 */
import { describe, expect, it } from 'vitest';

import { zFreeText, zSafeShortText, zSafeUrl } from '@/lib/validators/shared';

describe('zSafeUrl (XC-04 URL tier)', () => {
  const schema = zSafeUrl();

  it('accepts a plain https URL', () => {
    const r = schema.safeParse('https://example.com/hooks/pos');
    expect(r.success).toBe(true);
  });

  it('trims surrounding whitespace before validating', () => {
    const r = schema.safeParse('  https://example.com/x  ');
    expect(r.success).toBe(true);
    if (r.success) expect(r.data).toBe('https://example.com/x');
  });

  it('rejects a URL carrying <script> markup', () => {
    const r = schema.safeParse('https://example.com/<script>alert(1)</script>');
    expect(r.success).toBe(false);
  });

  it('rejects a URL containing a space', () => {
    const r = schema.safeParse('https://example.com/a b');
    expect(r.success).toBe(false);
  });

  it('rejects quote characters (attribute-breakout)', () => {
    expect(schema.safeParse('https://example.com/"x').success).toBe(false);
    expect(schema.safeParse("https://example.com/'x").success).toBe(false);
  });

  it('rejects a non-URL string', () => {
    expect(schema.safeParse('not-a-url').success).toBe(false);
  });

  it('honours the maxLen argument', () => {
    const short = zSafeUrl(20);
    expect(short.safeParse('https://example.com/way-too-long-path').success).toBe(false);
  });
});

describe('zSafeShortText (XC-04 short-identifier tier)', () => {
  const schema = zSafeShortText(80);

  it('rejects <b> markup', () => {
    expect(schema.safeParse('<b>Daily Sales</b>').success).toBe(false);
  });

  it('rejects backtick', () => {
    expect(schema.safeParse('report`name').success).toBe(false);
  });

  it('accepts unicode names byte-exact after trim', () => {
    const r = schema.safeParse('  सजाओ — Report 01  ');
    expect(r.success).toBe(true);
    if (r.success) expect(r.data).toBe('सजाओ — Report 01');
  });

  it('rejects empty / whitespace-only values', () => {
    expect(schema.safeParse('   ').success).toBe(false);
  });

  it('rejects over-length values', () => {
    expect(schema.safeParse('x'.repeat(81)).success).toBe(false);
  });
});

describe('zFreeText (XC-04 free-text tier: store verbatim, escape on render)', () => {
  const schema = zFreeText(500);

  it('preserves a <script> payload verbatim (no store-time encoding)', () => {
    const input = '<script>alert("xss")</script>';
    const r = schema.safeParse(input);
    expect(r.success).toBe(true);
    if (r.success) expect(r.data).toBe(input);
  });

  it('preserves unicode byte-exact (proves no over-sanitization)', () => {
    const input = 'सजाओ — usage instructions 🙂 <>&"\' ok';
    const r = schema.safeParse(input);
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data).toBe(input);
      expect(Buffer.from(r.data, 'utf8').equals(Buffer.from(input, 'utf8'))).toBe(true);
    }
  });

  it('bounds length only', () => {
    expect(schema.safeParse('x'.repeat(501)).success).toBe(false);
  });
});
