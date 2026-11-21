/**
 * ARGUS #340 — pure staff audit snapshot/diff contract.
 *
 * The service passes full Prisma user rows into these helpers. These tests pin
 * the allow-list, the bounded text, and the promise that secrets never reach
 * the audit ledger.
 */
import { describe, expect, it } from 'vitest';
import {
  STAFF_AUDIT_TEXT_LIMIT,
  STAFF_CREATED_AUDIT_FIELDS,
  STAFF_PROFILE_AUDIT_FIELDS,
  buildStaffAuditSnapshot,
  diffStaffAuditFields,
  formatCommissionRateForAudit,
} from '@/lib/services/staffAudit.core';

const before = {
  email: 'old@example.com',
  fullName: 'Nimal Perera',
  nic: '912345678V',
  contactNumber: '+94712345678',
  address: '12 Galle Road, Colombo',
  basicSalary: '45000.00',
  allowances: '5000.00',
  bankName: 'Commercial Bank',
  bankBranch: 'Colombo 03',
  bankAccountNumber: '1234567890',
  etfNumber: 'ETF-123',
  epfNumber: 'EPF-456',
  // Never allowed into a snapshot:
  passwordHash: '$2a$12$secret',
  sessionVersion: 7,
  permissions: ['staff:manage'],
};

describe('buildStaffAuditSnapshot', () => {
  it('keeps only allow-listed fields', () => {
    const snapshot = buildStaffAuditSnapshot(before, STAFF_PROFILE_AUDIT_FIELDS);
    expect(Object.keys(snapshot).sort()).toEqual([...STAFF_PROFILE_AUDIT_FIELDS].sort());
  });

  it('never includes secrets, permissions or session state', () => {
    const snapshot = buildStaffAuditSnapshot(before, [...STAFF_CREATED_AUDIT_FIELDS, 'passwordHash', 'sessionVersion']);
    expect(snapshot).not.toHaveProperty('passwordHash');
    expect(snapshot).not.toHaveProperty('sessionVersion');
    expect(snapshot).not.toHaveProperty('permissions');
    expect(JSON.stringify(snapshot)).not.toContain('secret');
  });

  it('bounds long free text', () => {
    const snapshot = buildStaffAuditSnapshot(
      { address: 'x'.repeat(500) },
      ['address'],
    );
    expect(snapshot.address).toBeTypeOf('string');
    expect((snapshot.address as string).length).toBe(STAFF_AUDIT_TEXT_LIMIT);
    expect(snapshot.address).toMatch(/\.\.\.$/);
  });

  it('normalises null/undefined and Decimal-like values', () => {
    const decimalLike = { toFixed: (digits?: number) => Number(45000).toFixed(digits) };
    const snapshot = buildStaffAuditSnapshot(
      { nic: null, address: undefined, basicSalary: decimalLike },
      ['nic', 'address', 'basicSalary'],
    );
    expect(snapshot).toEqual({ nic: null, address: null, basicSalary: '45000.00' });
  });
});

describe('diffStaffAuditFields', () => {
  it('emits only fields whose values changed', () => {
    const diff = diffStaffAuditFields(
      before,
      { ...before, bankAccountNumber: '9999999999', address: '  ' },
      STAFF_PROFILE_AUDIT_FIELDS,
    );

    expect(diff.fields.sort()).toEqual(['address', 'bankAccountNumber']);
    expect(diff.before).toEqual({
      address: '12 Galle Road, Colombo',
      bankAccountNumber: '1234567890',
    });
    expect(diff.after).toEqual({ address: '  ', bankAccountNumber: '9999999999' });
  });

  it('treats numerically equal Decimal rates as unchanged (5 vs 5.00)', () => {
    const decimal = (digits: number) => ({ toFixed: (dp?: number) => digits.toFixed(dp) });
    const diff = diffStaffAuditFields(
      { commissionRate: decimal(5) },
      { commissionRate: decimal(5) },
      ['commissionRate'],
    );
    expect(diff.fields).toEqual([]);
    expect(diff.before).toEqual({});
    expect(diff.after).toEqual({});
  });

  it('reports a commission-rate change with the old and new value', () => {
    const diff = diffStaffAuditFields(
      { commissionRate: '5.00' },
      { commissionRate: '7.50' },
      ['commissionRate'],
    );
    expect(diff.fields).toEqual(['commissionRate']);
    expect(diff.before).toEqual({ commissionRate: '5.00' });
    expect(diff.after).toEqual({ commissionRate: '7.50' });
  });

  it('never diffs secret columns even when they changed', () => {
    const diff = diffStaffAuditFields(
      { ...before, passwordHash: 'old-hash' },
      { ...before, passwordHash: 'new-hash' },
      [...STAFF_PROFILE_AUDIT_FIELDS, 'passwordHash'],
    );
    expect(diff.fields).toEqual([]);
  });
});

describe('formatCommissionRateForAudit', () => {
  it('formats rates to two decimals for stable comparisons', () => {
    expect(formatCommissionRateForAudit('5')).toBe('5.00');
    expect(formatCommissionRateForAudit(7.5)).toBe('7.50');
    expect(formatCommissionRateForAudit(null)).toBeNull();
    expect(formatCommissionRateForAudit('')).toBeNull();
    expect(formatCommissionRateForAudit('not-a-number')).toBeNull();
  });
});
