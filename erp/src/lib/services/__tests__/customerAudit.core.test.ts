import { describe, expect, it } from 'vitest';

import { customerAuditSnapshot } from '@/lib/services/customerAudit.core';

/** ARGUS #315: customer master changes must carry a stable audit snapshot. */
describe('customerAuditSnapshot', () => {
  const base = {
    name: 'Nimal Perera',
    phone: '0771234567',
    phone2: null,
    email: 'nimal@example.com',
    address: null,
    city: 'Colombo',
    gender: 'MALE',
    birthday: new Date('1990-05-04T00:00:00.000Z'),
    tags: ['vip'],
    notes: null,
    isActive: true,
  };

  it('serialises the birthday and preserves the tracked fields', () => {
    expect(customerAuditSnapshot(base)).toEqual({
      name: 'Nimal Perera',
      phone: '0771234567',
      phone2: null,
      email: 'nimal@example.com',
      address: null,
      city: 'Colombo',
      gender: 'MALE',
      birthday: '1990-05-04T00:00:00.000Z',
      tags: ['vip'],
      notes: null,
      isActive: true,
    });
  });

  it('keeps an absent birthday as null', () => {
    expect(customerAuditSnapshot({ ...base, birthday: null }).birthday).toBeNull();
  });

  it('records the deleted/inactive state for a delete audit row', () => {
    expect(customerAuditSnapshot({ ...base, isActive: false }).isActive).toBe(false);
  });
});
