import { describe, it, expect, vi } from 'vitest';
import {
  buildContactRows,
  buildExportFilename,
  CONTACT_OPT_OUT_TAG,
  DEFAULT_ACTIVE_DAYS,
  isContactExcluded,
  matchesContactScope,
  normalizePhoneNumber,
  renderContactsCSV,
  renderContactsXLSX,
  REPEAT_EXPORT_THRESHOLD,
  type ContactCandidate,
} from '@/lib/services/customer-contact-export-core';

// ── Fixture helper ───────────────────────────────────────────────────────────

function makeCandidate(overrides: Partial<ContactCandidate> = {}): ContactCandidate {
  const now = new Date('2026-08-07T10:00:00.000Z');
  return {
    id: 'c1',
    name: 'Alice',
    phone: '0712345678',
    email: 'alice@example.com',
    tags: [],
    isActive: true,
    deletedAt: null,
    createdAt: now,
    totalSpend: { toNumber: () => 1250 },
    lastPurchaseAt: new Date('2026-08-01T00:00:00.000Z'),
    orderCount: 3,
    tenantName: 'Main Store',
    ...overrides,
  };
}

// ── Phone normalisation ──────────────────────────────────────────────────────

describe('normalizePhoneNumber', () => {
  it('converts a 10-digit local number to E.164', () => {
    expect(normalizePhoneNumber('0712345678')).toBe('94712345678');
  });

  it('accepts an already-prefixed number', () => {
    expect(normalizePhoneNumber('94712345678')).toBe('94712345678');
  });

  it('strips non-digit formatting', () => {
    expect(normalizePhoneNumber('+94 71 234 5678')).toBe('94712345678');
  });

  it('returns null for unrecognisable numbers', () => {
    expect(normalizePhoneNumber('123')).toBeNull();
    expect(normalizePhoneNumber('')).toBeNull();
  });
});

// ── Exclusion / opt-out ──────────────────────────────────────────────────────

describe('isContactExcluded', () => {
  it('excludes inactive customers', () => {
    expect(isContactExcluded(makeCandidate({ isActive: false }))).toBe(true);
  });

  it('excludes soft-deleted customers', () => {
    expect(isContactExcluded(makeCandidate({ deletedAt: new Date() }))).toBe(true);
  });

  it('excludes customers carrying the opt-out tag', () => {
    expect(isContactExcluded(makeCandidate({ tags: [CONTACT_OPT_OUT_TAG] }))).toBe(true);
  });

  it('is case-insensitive on the opt-out tag', () => {
    expect(isContactExcluded(makeCandidate({ tags: ['No-Contact'] }))).toBe(true);
  });

  it('includes ordinary active customers', () => {
    expect(isContactExcluded(makeCandidate())).toBe(false);
  });
});

// ── Scope filtering ──────────────────────────────────────────────────────────

describe('matchesContactScope', () => {
  const now = new Date('2026-08-07T10:00:00.000Z');

  it('includes everyone for ALL', () => {
    const inactive = makeCandidate({ isActive: false });
    expect(matchesContactScope(inactive, { scope: 'ALL', now })).toBe(true);
  });

  it('ACTIVE requires a purchase within the window', () => {
    const recent = makeCandidate({ lastPurchaseAt: new Date('2026-07-01T00:00:00.000Z') });
    const stale = makeCandidate({ lastPurchaseAt: new Date('2025-01-01T00:00:00.000Z') });
    const none = makeCandidate({ lastPurchaseAt: null });
    expect(matchesContactScope(recent, { scope: 'ACTIVE', activeDays: 90, now })).toBe(true);
    expect(matchesContactScope(stale, { scope: 'ACTIVE', activeDays: 90, now })).toBe(false);
    expect(matchesContactScope(none, { scope: 'ACTIVE', activeDays: 90, now })).toBe(false);
  });

  it('NEW uses createdAt within the window', () => {
    const fresh = makeCandidate({ createdAt: new Date('2026-08-05T00:00:00.000Z') });
    const old = makeCandidate({ createdAt: new Date('2025-01-01T00:00:00.000Z') });
    expect(matchesContactScope(fresh, { scope: 'NEW', activeDays: 90, now })).toBe(true);
    expect(matchesContactScope(old, { scope: 'NEW', activeDays: 90, now })).toBe(false);
  });

  it('REPEAT requires the minimum order count', () => {
    expect(
      matchesContactScope(makeCandidate({ orderCount: REPEAT_EXPORT_THRESHOLD }), {
        scope: 'REPEAT',
        now,
      }),
    ).toBe(true);
    expect(
      matchesContactScope(makeCandidate({ orderCount: 1 }), { scope: 'REPEAT', now }),
    ).toBe(false);
  });
});

// ── Row building / dedup ─────────────────────────────────────────────────────

describe('buildContactRows', () => {
  it('excludes opted-out and inactive customers and counts them', () => {
    const optedOut = makeCandidate({ id: 'x1', tags: [CONTACT_OPT_OUT_TAG] });
    const inactive = makeCandidate({ id: 'x2', isActive: false });
    const ok = makeCandidate({ id: 'c1' });
    const { rows, excluded } = buildContactRows([optedOut, inactive, ok], { scope: 'ALL' });
    expect(rows).toHaveLength(1);
    expect(rows[0]?.customerId).toBe('c1');
    expect(excluded).toBe(2);
  });

  it('deduplicates rows sharing the same phone, preferring the one with email', () => {
    const withEmail = makeCandidate({ id: 'a', phone: '0712345678', email: 'a@x.com' });
    const noEmail = makeCandidate({ id: 'b', phone: '0712345678', email: null });
    const { rows } = buildContactRows([noEmail, withEmail], { scope: 'ALL' });
    expect(rows).toHaveLength(1);
    expect(rows[0]?.email).toBe('a@x.com');
  });

  it('serialises lastPurchaseAt to ISO and totalSpend to a number', () => {
    const { rows } = buildContactRows([makeCandidate()], { scope: 'ALL' });
    expect(rows[0]?.lastPurchaseAt).toBe('2026-08-01T00:00:00.000Z');
    expect(rows[0]?.totalSpend).toBe(1250);
  });
});

// ── Rendering ────────────────────────────────────────────────────────────────

describe('renderContactsCSV', () => {
  it('emits a BOM, a header row, and one data row', () => {
    const { rows } = buildContactRows([makeCandidate()], { scope: 'ALL' });
    const csv = renderContactsCSV(rows);
    const lines = csv.replace(/^\uFEFF/, '').trim().split('\r\n');
    expect(lines[0]).toContain('customerId');
    expect(lines[0]).toContain('preferredStore');
    expect(lines[1]).toContain('c1');
    expect(lines[1]).toContain('Alice');
  });
});

describe('renderContactsXLSX', () => {
  it('produces a non-empty xlsx buffer', () => {
    const { rows } = buildContactRows([makeCandidate()], { scope: 'ALL' });
    const buffer = renderContactsXLSX(rows);
    expect(Buffer.isBuffer(buffer)).toBe(true);
    expect(buffer.byteLength).toBeGreaterThan(0);
  });
});

// ── Filename ─────────────────────────────────────────────────────────────────

describe('buildExportFilename', () => {
  it('uses the configured format and a timestamp', () => {
    const now = new Date('2026-08-07T10:05:30.000Z');
    expect(buildExportFilename('csv', now)).toBe('contacts-20260807-100530.csv');
    expect(buildExportFilename('xlsx', now)).toBe('contacts-20260807-100530.xlsx');
  });
});

// ── Config defaults ──────────────────────────────────────────────────────────

describe('defaults', () => {
  it('exposes a default active-days value', () => {
    expect(DEFAULT_ACTIVE_DAYS).toBe(90);
  });

  it('vi is available for future system-time assertions', () => {
    expect(typeof vi.useFakeTimers).toBe('function');
  });
});
