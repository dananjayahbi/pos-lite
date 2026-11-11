import { describe, it, expect } from 'vitest';

import {
  CUSTOMER_IMPORT_COLUMNS,
  CUSTOMER_IMPORT_TEMPLATE_CSV,
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

  it('accepts Phone2, Address and City and normalizes the secondary phone', () => {
    const parsed = CustomerCsvRowSchema.safeParse(
      row({
        Phone2: '071 234 5678',
        Address: '12 Galle Road, Colombo 03',
        City: 'Colombo',
      }),
    );
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.Phone2).toBe('+94712345678');
      expect(parsed.data.Address).toBe('12 Galle Road, Colombo 03');
      expect(parsed.data.City).toBe('Colombo');
    }
  });

  it('rejects a malformed Phone2', () => {
    const parsed = CustomerCsvRowSchema.safeParse(row({ Phone2: 'not-a-phone' }));
    expect(parsed.success).toBe(false);
  });

  it('treats an empty Phone2 / Address / City as optional', () => {
    const parsed = CustomerCsvRowSchema.safeParse(
      row({ Phone2: '', Address: '', City: '' }),
    );
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.Phone2).toBe('');
      expect(parsed.data.Address).toBe('');
      expect(parsed.data.City).toBe('');
    }
  });

  it('bounds address and city lengths', () => {
    expect(
      CustomerCsvRowSchema.safeParse(row({ Address: 'x'.repeat(251) })).success,
    ).toBe(false);
    expect(CustomerCsvRowSchema.safeParse(row({ City: 'x'.repeat(101) })).success).toBe(
      false,
    );
  });
});

describe('import template sync', () => {
  it('lists every schema column in the canonical order', () => {
    expect(Object.keys(CustomerCsvRowSchema.shape)).toEqual([...CUSTOMER_IMPORT_COLUMNS]);
  });

  it('writes exactly the canonical header line', () => {
    expect(CUSTOMER_IMPORT_TEMPLATE_CSV).toBe(
      'Name,Phone,Phone2,Email,Address,City,Gender,Birthday,Tags,Notes\n',
    );
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
