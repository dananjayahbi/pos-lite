import { describe, expect, it } from 'vitest';

import {
  hasCompleteTaxIdentity,
  missingTaxIdentityFields,
  readTaxIdentitySnapshot,
  taxIdentityFieldStatus,
} from '@/lib/settings/taxIdentity.core';

/**
 * ARGUS #471: the settings schema has no tax-registration or invoice-identity
 * fields, so the UI must say so instead of implying they exist. The reader is
 * forward-compatible if an operator has already placed values in the settings
 * blob, but never invents them.
 */
describe('tax identity readiness', () => {
  it('reports every identity field as missing on the current schema', () => {
    expect(missingTaxIdentityFields({ vatRate: 18, ssclRate: 2.5 })).toEqual([
      'VAT registration number',
      'SSCL registration number',
      'Invoice prefix',
      'Next invoice number',
    ]);
    expect(hasCompleteTaxIdentity({})).toBe(false);
  });

  it('treats missing, blank and malformed settings safely', () => {
    expect(readTaxIdentitySnapshot(undefined)).toEqual({
      vatRegistrationNumber: null,
      ssclRegistrationNumber: null,
      invoicePrefix: null,
      invoiceNextNumber: null,
    });
    expect(readTaxIdentitySnapshot({ invoicePrefix: '   ' }).invoicePrefix).toBeNull();
    expect(readTaxIdentitySnapshot({ invoicePrefix: 42 }).invoicePrefix).toBeNull();
  });

  it('surfaces values that are already present instead of claiming they are missing', () => {
    const settings = {
      vatRegistrationNumber: 'VAT-123456',
      ssclRegistrationNumber: 'SSCL-9988',
      invoicePrefix: 'INV',
      invoiceNextNumber: 1200,
    };

    expect(readTaxIdentitySnapshot(settings)).toEqual({
      vatRegistrationNumber: 'VAT-123456',
      ssclRegistrationNumber: 'SSCL-9988',
      invoicePrefix: 'INV',
      invoiceNextNumber: '1200',
    });
    expect(missingTaxIdentityFields(settings)).toEqual([]);
    expect(hasCompleteTaxIdentity(settings)).toBe(true);
  });

  it('reports only the fields still missing when a partial configuration exists', () => {
    const status = taxIdentityFieldStatus({
      vatRegistrationNumber: 'VAT-123456',
      invoicePrefix: 'INV',
    });

    expect(status.filter((field) => field.configured).map((field) => field.label)).toEqual([
      'VAT registration number',
      'Invoice prefix',
    ]);
    expect(missingTaxIdentityFields({ vatRegistrationNumber: 'VAT-123456' })).toContain(
      'SSCL registration number',
    );
  });

  it('keeps a stable field order for the settings table', () => {
    expect(taxIdentityFieldStatus({}).map((field) => field.key)).toEqual([
      'vatRegistrationNumber',
      'ssclRegistrationNumber',
      'invoicePrefix',
      'invoiceNextNumber',
    ]);
  });
});
