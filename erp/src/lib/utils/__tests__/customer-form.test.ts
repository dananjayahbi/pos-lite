import { describe, expect, it } from 'vitest';
import { customerToFormValues } from '@/lib/utils/customer-form';

describe('customerToFormValues — New Customer', () => {
  it('returns an empty form when no customer is supplied', () => {
    expect(customerToFormValues()).toEqual({
      name: '',
      phone: '',
      phone2: '',
      email: undefined,
      address: '',
      city: '',
      gender: undefined,
      birthday: undefined,
      tags: [],
      notes: undefined,
    });
  });
});

describe('customerToFormValues — Edit Customer prefill', () => {
  it('maps every customer field into the drawer values', () => {
    const values = customerToFormValues({
      id: 'cm1',
      name: 'Nimali Perera',
      phone: '+94770000003',
      phone2: '+94771234567',
      email: 'nimali@example.com',
      address: '12 Galle Road, Colombo',
      city: 'Colombo',
      gender: 'FEMALE',
      birthday: '1985-06-21T00:00:00.000Z',
      tags: ['VIP'],
      notes: 'Prefers SMS',
    });

    expect(values).toMatchObject({
      name: 'Nimali Perera',
      phone: '+94770000003',
      phone2: '+94771234567',
      email: 'nimali@example.com',
      address: '12 Galle Road, Colombo',
      city: 'Colombo',
      gender: 'FEMALE',
      birthday: '1985-06-21',
      tags: ['VIP'],
      notes: 'Prefers SMS',
    });
  });

  it('normalizes nullable columns to empty form values', () => {
    const values = customerToFormValues({
      id: 'cm2',
      name: 'Walk-in',
      phone: '+94770000001',
      phone2: null,
      email: null,
      address: null,
      city: null,
      gender: null,
      birthday: null,
      tags: [],
      notes: null,
    });

    expect(values.phone2).toBe('');
    expect(values.email).toBeUndefined();
    expect(values.address).toBe('');
    expect(values.city).toBe('');
    expect(values.gender).toBeUndefined();
    expect(values.birthday).toBeUndefined();
    expect(values.notes).toBeUndefined();
  });

  it('does not mutate the source customer', () => {
    const source = {
      name: 'Amara',
      phone: '+94770000001',
      tags: ['VIP'],
    };
    const values = customerToFormValues(source);
    values.tags?.push('REGULAR');

    expect(source.tags).toEqual(['VIP']);
  });
});
