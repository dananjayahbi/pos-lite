import { describe, expect, it } from 'vitest';

import { supplierAuditSnapshot } from '@/lib/services/supplierAudit.core';

/** ARGUS #237: create/edit/archive need before/after supplier snapshots. */
describe('supplierAuditSnapshot', () => {
  it('copies the editable supplier fields', () => {
    expect(
      supplierAuditSnapshot({
        name: 'Lanka Textile Mills',
        contactName: 'Nimal',
        phone: '0771234567',
        whatsappNumber: '+94771234567',
        email: 'orders@example.com',
        address: 'Colombo',
        leadTimeDays: 7,
        notes: 'preferred',
        isActive: true,
      }),
    ).toEqual({
      name: 'Lanka Textile Mills',
      contactName: 'Nimal',
      phone: '0771234567',
      whatsappNumber: '+94771234567',
      email: 'orders@example.com',
      address: 'Colombo',
      leadTimeDays: 7,
      notes: 'preferred',
      isActive: true,
    });
  });

  it('normalises optional fields to null', () => {
    expect(
      supplierAuditSnapshot({
        name: 'Minimal',
        phone: '+94711111111',
        leadTimeDays: 7,
        isActive: false,
      }),
    ).toEqual({
      name: 'Minimal',
      contactName: null,
      phone: '+94711111111',
      whatsappNumber: null,
      email: null,
      address: null,
      leadTimeDays: 7,
      notes: null,
      isActive: false,
    });
  });

  it('does not leak relation/timestamp/id fields', () => {
    const snapshot = supplierAuditSnapshot({
      name: 'Shape',
      phone: '0771234567',
      leadTimeDays: 0,
      isActive: true,
    });
    expect(Object.keys(snapshot).sort()).toEqual([
      'address',
      'contactName',
      'email',
      'isActive',
      'leadTimeDays',
      'name',
      'notes',
      'phone',
      'whatsappNumber',
    ]);
  });
});
