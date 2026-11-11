import { describe, expect, it } from 'vitest';
import {
  CreateStaffSchema,
  StaffListQuerySchema,
  UpdateStaffSchema,
} from '@/lib/validators/staff.validators';

const base = { email: 'staff@example.com', role: 'CASHIER' as const };

describe('CreateStaffSchema — HR profile fields', () => {
  it('accepts the full onboarding payload', () => {
    const parsed = CreateStaffSchema.parse({
      ...base,
      fullName: 'Nimal Perera',
      nic: '912345678V',
      contactNumber: '071 234 5678',
      address: '12 Galle Road, Colombo',
      basicSalary: '45000.00',
      allowances: '5000',
      bankName: 'Commercial Bank',
      bankBranch: 'Colombo 03',
      bankAccountNumber: '1234567890',
      etfNumber: 'ETF-123',
      epfNumber: 'EPF-456',
    });

    expect(parsed.fullName).toBe('Nimal Perera');
    expect(parsed.nic).toBe('912345678V');
    expect(parsed.contactNumber).toBe('+94712345678');
    expect(parsed.basicSalary).toBe('45000.00');
    expect(parsed.allowances).toBe('5000');
  });

  it('accepts both NIC formats', () => {
    expect(CreateStaffSchema.safeParse({ ...base, nic: '912345678V' }).success).toBe(true);
    expect(CreateStaffSchema.safeParse({ ...base, nic: '199912345678' }).success).toBe(true);
    expect(CreateStaffSchema.safeParse({ ...base, nic: '912345678' }).success).toBe(false);
    expect(CreateStaffSchema.safeParse({ ...base, nic: 'not-an-nic' }).success).toBe(false);
  });

  it('rejects malformed contact numbers', () => {
    expect(
      CreateStaffSchema.safeParse({ ...base, contactNumber: 'not-a-phone' }).success,
    ).toBe(false);
  });

  it('bounds salary amounts to two decimals and the column ceiling', () => {
    expect(CreateStaffSchema.safeParse({ ...base, basicSalary: '45000.123' }).success).toBe(false);
    expect(CreateStaffSchema.safeParse({ ...base, basicSalary: '1000000000' }).success).toBe(false);
    expect(CreateStaffSchema.safeParse({ ...base, basicSalary: '0' }).success).toBe(true);
  });

  it('keeps every HR field optional for backwards compatibility', () => {
    const parsed = CreateStaffSchema.parse(base);
    expect(parsed.fullName).toBeUndefined();
    expect(parsed.nic).toBeUndefined();
    expect(parsed.basicSalary).toBeUndefined();
  });
});

describe('StaffListQuerySchema — table filters', () => {
  it('accepts a name/email search and an assignable role', () => {
    const parsed = StaffListQuerySchema.parse({ search: 'Nimal', role: 'CASHIER' });
    expect(parsed.search).toBe('Nimal');
    expect(parsed.role).toBe('CASHIER');
  });

  it('rejects a non-assignable role', () => {
    expect(StaffListQuerySchema.safeParse({ role: 'SUPER_ADMIN' }).success).toBe(false);
    expect(StaffListQuerySchema.safeParse({ role: 'NOPE' }).success).toBe(false);
  });
});

describe('UpdateStaffSchema — partial HR updates', () => {
  it('accepts a single profile field', () => {
    const parsed = UpdateStaffSchema.parse({ address: 'New address' });
    expect(parsed.address).toBe('New address');
  });

  it('allows clearing a nullable profile field with an empty string', () => {
    const parsed = UpdateStaffSchema.parse({ bankName: '' });
    expect(parsed.bankName).toBe('');
  });
});
