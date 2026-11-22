import { describe, expect, it } from 'vitest';

import {
  canManageTaxSettings,
  readStoreProfileSnapshot,
  readTaxRates,
  storeProfileAuditPayload,
  taxSettingsAuditPayload,
} from '@/lib/settings/settingsAudit.core';

/** ARGUS #468 — tax is owner-only; both settings writes carry bounded audits. */
describe('canManageTaxSettings', () => {
  it('allows the tenant owner and platform superadmin', () => {
    expect(canManageTaxSettings('OWNER')).toBe(true);
    expect(canManageTaxSettings('SUPER_ADMIN')).toBe(true);
  });

  it('rejects managers and everyone else', () => {
    for (const role of ['MANAGER', 'CASHIER', 'STOCK_CLERK', 'DISPATCH_STAFF', 'FACTORY_MANAGER']) {
      expect(canManageTaxSettings(role)).toBe(false);
    }
    expect(canManageTaxSettings(undefined)).toBe(false);
    expect(canManageTaxSettings(null)).toBe(false);
  });
});

describe('readTaxRates', () => {
  it('reads numeric rates and defaults missing/invalid ones to 0', () => {
    expect(readTaxRates({ vatRate: 18, ssclRate: 2.5, apiKey: 'secret' })).toEqual({
      vatRate: 18,
      ssclRate: 2.5,
    });
    expect(readTaxRates({ vatRate: '18', ssclRate: null })).toEqual({ vatRate: 0, ssclRate: 0 });
    expect(readTaxRates(null)).toEqual({ vatRate: 0, ssclRate: 0 });
  });
});

describe('taxSettingsAuditPayload', () => {
  it('contains only the two tax rates', () => {
    expect(
      taxSettingsAuditPayload(
        { vatRate: 18, ssclRate: 2.5 },
        { vatRate: 0, ssclRate: 0 },
      ),
    ).toEqual({
      before: { vatRate: 18, ssclRate: 2.5 },
      after: { vatRate: 0, ssclRate: 0 },
    });
    expect(
      Object.keys(
        taxSettingsAuditPayload({ vatRate: 1, ssclRate: 1 }, { vatRate: 2, ssclRate: 2 }).after,
      ).sort(),
    ).toEqual(['ssclRate', 'vatRate']);
  });
});

describe('readStoreProfileSnapshot / storeProfileAuditPayload', () => {
  it('reads only the profile fields', () => {
    expect(
      readStoreProfileSnapshot({
        name: 'Dilani Ayurveda',
        logoUrl: 'https://cdn.example/logo.png',
        settings: {
          address: '12 Flower Road',
          phoneNumber: '011 234 5678',
          email: 'hello@example.lk',
          receiptFooter: 'Thank you',
          apiKey: 'must-not-leak',
        },
      }),
    ).toEqual({
      storeName: 'Dilani Ayurveda',
      logoUrl: 'https://cdn.example/logo.png',
      address: '12 Flower Road',
      phoneNumber: '011 234 5678',
      email: 'hello@example.lk',
      receiptFooter: 'Thank you',
    });
  });

  it('normalizes missing values without leaking settings', () => {
    expect(
      readStoreProfileSnapshot({ name: null, logoUrl: null, settings: { apiKey: 'secret' } }),
    ).toEqual({
      storeName: '',
      logoUrl: null,
      address: '',
      phoneNumber: '',
      email: '',
      receiptFooter: '',
    });
  });

  it('builds a bounded before/after profile payload', () => {
    const before = readStoreProfileSnapshot({
      name: 'Old',
      logoUrl: null,
      settings: { address: 'A', phoneNumber: '1', receiptFooter: 'F' },
    });
    const after = readStoreProfileSnapshot({
      name: 'New',
      logoUrl: 'https://cdn.example/new.png',
      settings: { address: 'B', phoneNumber: '2', receiptFooter: 'G' },
    });
    expect(storeProfileAuditPayload(before, after)).toEqual({ before, after });
    expect(Object.keys(storeProfileAuditPayload(before, after).after).sort()).toEqual([
      'address',
      'email',
      'logoUrl',
      'phoneNumber',
      'receiptFooter',
      'storeName',
    ]);
  });
});

