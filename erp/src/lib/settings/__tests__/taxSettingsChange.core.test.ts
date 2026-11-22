import { describe, expect, it } from 'vitest';

import {
  parseTaxRateInput,
  readTaxSchedule,
  rejectTaxChange,
  resolveActiveTaxRates,
  taxSchedulePatch,
} from '@/lib/settings/taxSettingsChange.core';

const TODAY = '2026-11-22';

/**
 * ARGUS #475: tax changes need an effective date, a version and a zero-rate
 * confirmation instead of immediate last-write-wins.
 */
describe('tax schedule', () => {
  it('applies legacy unscheduled rates immediately', () => {
    const schedule = readTaxSchedule({ vatRate: 18, ssclRate: 2.5 }, TODAY);
    expect(schedule.active).toEqual({ vatRate: 18, ssclRate: 2.5 });
    expect(schedule.version).toBe(0);
    expect(schedule.pending).toBeNull();
  });

  it('keeps the prior rates active until a future effective date', () => {
    const settings = {
      vatRate: 20,
      ssclRate: 3,
      taxEffectiveFrom: '2026-12-01',
      taxPriorRates: { vatRate: 18, ssclRate: 2.5 },
      taxVersion: 4,
    };

    expect(resolveActiveTaxRates(settings, new Date('2026-11-22T10:00:00Z'))).toEqual({
      vatRate: 18,
      ssclRate: 2.5,
    });
    expect(readTaxSchedule(settings, TODAY).pending).toEqual({
      vatRate: 20,
      ssclRate: 3,
      effectiveFrom: '2026-12-01',
    });
  });

  it('activates a scheduled change on its effective date', () => {
    const settings = {
      vatRate: 20,
      ssclRate: 3,
      taxEffectiveFrom: '2026-12-01',
      taxPriorRates: { vatRate: 18, ssclRate: 2.5 },
    };
    expect(resolveActiveTaxRates(settings, new Date('2026-12-01T00:00:00Z'))).toEqual({
      vatRate: 20,
      ssclRate: 3,
    });
  });

  it('writes the next version, prior rates and a bounded history entry', () => {
    const patch = taxSchedulePatch({
      settings: { vatRate: 18, ssclRate: 2.5, taxVersion: 2, receiptFooter: 'x' },
      next: { vatRate: 19, ssclRate: 2.5 },
      effectiveFrom: '2026-12-01',
      today: TODAY,
      now: new Date('2026-11-22T12:00:00.000Z'),
    });

    expect(patch.version).toBe(3);
    expect(patch.settings.vatRate).toBe(19);
    expect(patch.settings.taxEffectiveFrom).toBe('2026-12-01');
    expect(patch.settings.taxPriorRates).toEqual({ vatRate: 18, ssclRate: 2.5 });
    expect(patch.settings.receiptFooter).toBe('x');
    expect(patch.settings.taxRateHistory).toEqual([
      {
        vatRate: 18,
        ssclRate: 2.5,
        effectiveFrom: TODAY,
        recordedAt: '2026-11-22T12:00:00.000Z',
      },
    ]);
  });
});

describe('tax change guard', () => {
  const base = {
    current: { vatRate: 18, ssclRate: 2.5 },
    currentVersion: 3,
    next: { vatRate: 19, ssclRate: 2.5 },
    effectiveFrom: TODAY,
    today: TODAY,
  };

  it('allows a normal change with the loaded version', () => {
    expect(rejectTaxChange({ ...base, expectedVersion: 3 })).toBeNull();
  });

  it('rejects a stale version with a reload message', () => {
    expect(rejectTaxChange({ ...base, expectedVersion: 2 })).toMatchObject({
      code: 'VERSION_CONFLICT',
    });
  });

  it('accepts legacy clients that do not send a version', () => {
    expect(rejectTaxChange(base)).toBeNull();
  });

  it('requires explicit confirmation before zeroing a non-zero rate', () => {
    expect(
      rejectTaxChange({
        ...base,
        next: { vatRate: 0, ssclRate: 2.5 },
        expectedVersion: 3,
      }),
    ).toMatchObject({ code: 'ZERO_RATE_CONFIRMATION_REQUIRED' });
    expect(
      rejectTaxChange({
        ...base,
        next: { vatRate: 0, ssclRate: 2.5 },
        expectedVersion: 3,
        acknowledgeZeroRate: true,
      }),
    ).toBeNull();
  });

  it('does not demand confirmation when the rate was already zero', () => {
    expect(
      rejectTaxChange({
        ...base,
        current: { vatRate: 0, ssclRate: 0 },
        next: { vatRate: 0, ssclRate: 0 },
      }),
    ).toBeNull();
  });
});

describe('parseTaxRateInput', () => {
  it('never turns an empty field into a 0% rate', () => {
    expect(parseTaxRateInput('')).toEqual({
      value: null,
      error: 'Enter a rate between 0 and 100.',
    });
    expect(parseTaxRateInput('   ')).toEqual({
      value: null,
      error: 'Enter a rate between 0 and 100.',
    });
  });

  it('accepts decimals in range', () => {
    expect(parseTaxRateInput(' 2.5 ')).toEqual({ value: 2.5, error: null });
  });

  it('rejects non-numeric and out-of-range values', () => {
    expect(parseTaxRateInput('abc')).toMatchObject({ value: null, error: expect.any(String) });
    expect(parseTaxRateInput('-1')).toEqual({ value: null, error: 'Rate must be between 0 and 100.' });
    expect(parseTaxRateInput('101')).toEqual({ value: null, error: 'Rate must be between 0 and 100.' });
  });
});
