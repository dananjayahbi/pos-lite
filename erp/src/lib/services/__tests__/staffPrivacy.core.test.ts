/**
 * ARGUS #341 — staff directory privacy contract.
 *
 * The list must never expose salary/bank/HR PII; the detail endpoint returns
 * those fields only for the stronger staff:manage permission and masks the
 * bank account number otherwise.
 */
import { describe, expect, it } from 'vitest';
import {
  STAFF_LIST_FIELDS,
  STAFF_SENSITIVE_FIELDS,
  maskBankAccountNumber,
  toStaffDetailDto,
  toStaffListDto,
} from '@/lib/services/staffPrivacy.core';

const fullStaffRow = {
  id: 'staff-1',
  email: 'nimal@example.com',
  role: 'CASHIER',
  isActive: true,
  permissions: ['staff:view', 42, 'sale:create'],
  commissionRate: '5.00',
  clockedInAt: null,
  lastLoginAt: new Date('2026-11-01T10:00:00Z'),
  createdAt: new Date('2026-01-01T00:00:00Z'),
  fullName: 'Nimal Perera',
  contactNumber: '+94712345678',
  nic: '912345678V',
  address: '12 Galle Road, Colombo',
  basicSalary: '45000.00',
  allowances: '5000.00',
  bankName: 'Commercial Bank',
  bankBranch: 'Colombo 03',
  bankAccountNumber: '1234567890',
  etfNumber: 'ETF-123',
  epfNumber: 'EPF-456',
};

describe('toStaffListDto', () => {
  it('returns only the directory fields', () => {
    const dto = toStaffListDto(fullStaffRow);
    expect(Object.keys(dto).sort()).toEqual([...STAFF_LIST_FIELDS].sort());
  });

  it('never leaks salary, bank, NIC, address or statutory fields', () => {
    const dto = toStaffListDto(fullStaffRow);
    for (const field of STAFF_SENSITIVE_FIELDS) {
      expect(dto).not.toHaveProperty(field);
    }
    expect(JSON.stringify(dto)).not.toContain('912345678V');
    expect(JSON.stringify(dto)).not.toContain('Commercial Bank');
    expect(JSON.stringify(dto)).not.toContain('45000');
  });

  it('keeps the fields the staff table renders', () => {
    const dto = toStaffListDto(fullStaffRow);
    expect(dto.fullName).toBe('Nimal Perera');
    expect(dto.contactNumber).toBe('+94712345678');
    expect(dto.commissionRate).toBe('5.00');
  });
});

describe('toStaffDetailDto', () => {
  it('returns every sensitive field only with the stronger permission', () => {
    const dto = toStaffDetailDto(fullStaffRow, { includeSensitive: true });
    expect(dto.nic).toBe('912345678V');
    expect(dto.basicSalary).toBe('45000.00');
    expect(dto.bankAccountNumber).toBe('1234567890');
  });

  it('nulls HR/salary/bank fields for a directory-only viewer', () => {
    const dto = toStaffDetailDto(fullStaffRow, { includeSensitive: false });
    for (const field of STAFF_SENSITIVE_FIELDS) {
      if (field === 'bankAccountNumber') continue;
      expect(dto[field]).toBeNull();
    }
    expect(dto.bankAccountNumber).toBe('****7890');
  });

  it('still returns identity, role and permission data to a directory viewer', () => {
    const dto = toStaffDetailDto(fullStaffRow, { includeSensitive: false });
    expect(dto.email).toBe('nimal@example.com');
    expect(dto.role).toBe('CASHIER');
    expect(dto.permissions).toEqual(['staff:view', 'sale:create']);
  });
});

describe('maskBankAccountNumber', () => {
  it('shows only the last four digits', () => {
    expect(maskBankAccountNumber('1234567890')).toBe('****7890');
    expect(maskBankAccountNumber('000123')).toBe('****0123');
  });

  it('fully masks very short values', () => {
    expect(maskBankAccountNumber('12')).toBe('**');
    expect(maskBankAccountNumber('1234')).toBe('****');
  });

  it('returns null for empty input', () => {
    expect(maskBankAccountNumber(null)).toBeNull();
    expect(maskBankAccountNumber(undefined)).toBeNull();
    expect(maskBankAccountNumber('   ')).toBeNull();
  });
});
