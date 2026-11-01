import { describe, it, expect } from 'vitest';

import {
  CustomerCsvRowSchema,
  normalizeSriLankaPhone,
} from '@/lib/validators/customer-import.validators';

function row(overrides: Record<string, string> = {}) {
  return { Name: 'Nimal Perera', Phone: '0771234567', ...overrides };
}

describe('CustomerCsvRowSchema', () => {
  it('accepts a 10-digit local mobile and normalizes it to +94', () => {
    const parsed = CustomerCsvRowSchema.safeParse(row());
    expect(parsed.success).toBe(true);
    if (parsed.success) expect(parsed.data.Phone).toBe('+94771234567');
  });

  it('accepts the +94 form unchanged', () => {
    const parsed = CustomerCsvRowSchema.safeParse(row({ Phone: '+94771234567' }));
    expect(parsed.success).toBe(true);
    if (parsed.success) expect(parsed.data.Phone).toBe('+94771234567');
  });

  it('strips spaces, dashes and parentheses before validating', () => {
    const parsed = CustomerCsvRowSchema.safeParse(row({ Phone: '077-123 4567' }));
    expect(parsed.success).toBe(true);
    if (parsed.success) expect(parsed.data.Phone).toBe('+94771234567');
  });

  it('rejects a 9-digit phone', () => {
    const parsed = CustomerCsvRowSchema.safeParse(row({ Phone: '088878787' }));
    expect(parsed.success).toBe(false);
  });

  it('rejects a missing phone', () => {
    const parsed = CustomerCsvRowSchema.safeParse({ Name: 'Nimal' });
    expect(parsed.success).toBe(false);
  });

  it('rejects a phone with a non-SL country code', () => {
    const parsed = CustomerCsvRowSchema.safeParse(row({ Phone: '+15551234567' }));
    expect(parsed.success).toBe(false);
  });
});

describe('normalizeSriLankaPhone', () => {
  it('converts local numbers to +94', () => {
    expect(normalizeSriLankaPhone('0771234567')).toBe('+94771234567');
    expect(normalizeSriLankaPhone('077-123 4567')).toBe('+94771234567');
  });

  it('leaves +94 numbers alone', () => {
    expect(normalizeSriLankaPhone('+94771234567')).toBe('+94771234567');
  });
});
