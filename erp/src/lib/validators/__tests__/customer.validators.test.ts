import { describe, expect, it } from 'vitest';
import {
  CreateCustomerSchema,
  UpdateCustomerSchema,
} from '@/lib/validators/customer.validators';

const base = { name: 'Nimal Perera', phone: '0771234567' };

describe('CreateCustomerSchema — contact and address fields', () => {
  it('accepts address, city, and a valid secondary contact', () => {
    const parsed = CreateCustomerSchema.parse({
      ...base,
      phone2: '071 234 5678',
      address: '  12 Galle Road, Colombo 03  ',
      city: '  Colombo  ',
    });

    expect(parsed.phone).toBe('+94771234567');
    expect(parsed.phone2).toBe('+94712345678');
    expect(parsed.address).toBe('12 Galle Road, Colombo 03');
    expect(parsed.city).toBe('Colombo');
  });

  it('treats an empty Contact No 2 as omitted/optional', () => {
    const parsed = CreateCustomerSchema.parse({ ...base, phone2: '' });
    expect(parsed.phone2).toBe('');
  });

  it('rejects a malformed Contact No 2', () => {
    const result = CreateCustomerSchema.safeParse({ ...base, phone2: 'not-a-phone' });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.some((issue) => issue.path.includes('phone2'))).toBe(true);
    }
  });

  it('bounds the address and city lengths', () => {
    const longAddress = CreateCustomerSchema.safeParse({
      ...base,
      address: 'x'.repeat(251),
    });
    const longCity = CreateCustomerSchema.safeParse({
      ...base,
      city: 'x'.repeat(101),
    });

    expect(longAddress.success).toBe(false);
    expect(longCity.success).toBe(false);
  });

  it('accepts an address and city without requiring a secondary contact', () => {
    const parsed = CreateCustomerSchema.parse({
      ...base,
      address: 'No. 5, Temple Road',
      city: 'Kandy',
    });
    expect(parsed.address).toBe('No. 5, Temple Road');
    expect(parsed.city).toBe('Kandy');
    expect(parsed.phone2).toBeUndefined();
  });
});

describe('UpdateCustomerSchema — partial updates', () => {
  it('allows updating only the address / city / secondary contact', () => {
    const parsed = UpdateCustomerSchema.parse({
      address: 'New address',
      city: 'Galle',
      phone2: '',
    });
    expect(parsed.address).toBe('New address');
    expect(parsed.city).toBe('Galle');
    expect(parsed.phone2).toBe('');
  });

  it('clears an email with an empty string or null', () => {
    expect(UpdateCustomerSchema.parse({ email: '' }).email).toBeNull();
    expect(UpdateCustomerSchema.parse({ email: null }).email).toBeNull();
  });

  it('keeps a valid lower-cased email', () => {
    expect(UpdateCustomerSchema.parse({ email: ' QA@Example.COM ' }).email).toBe(
      'qa@example.com',
    );
  });

  it('rejects a malformed non-empty email', () => {
    expect(UpdateCustomerSchema.safeParse({ email: 'not-an-email' }).success).toBe(false);
  });

  it('clears a birthday with an empty string or null', () => {
    expect(UpdateCustomerSchema.parse({ birthday: '' }).birthday).toBeNull();
    expect(UpdateCustomerSchema.parse({ birthday: null }).birthday).toBeNull();
  });

  it('parses a real birthday and rejects garbage', () => {
    const parsed = UpdateCustomerSchema.parse({ birthday: '1985-06-21' });
    expect(parsed.birthday).toBeInstanceOf(Date);
    expect(UpdateCustomerSchema.safeParse({ birthday: 'not-a-date' }).success).toBe(false);
  });
});
