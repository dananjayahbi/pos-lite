import { describe, expect, it } from 'vitest';

import { Prisma } from '@/generated/prisma/client';
import {
  AUDIT_ACTIONS,
  FINANCIAL_AUDIT_ACTIONS,
  buildAuditLogData,
  createAuditLogInTransaction,
  type CreateAuditLogInput,
} from '@/lib/services/audit.service';

const input: CreateAuditLogInput = {
  tenantId: 'tenant-1',
  actorId: 'user-1',
  actorRole: 'MANAGER',
  entityType: 'PaymentAccountTransfer',
  entityId: 'group-1',
  action: AUDIT_ACTIONS.PAYMENT_ACCOUNT_TRANSFER,
  before: null,
  after: { amount: 100 },
};

/** ARGUS #426: financial audit rows must be atomic with the movement. */
describe('financial audit actions', () => {
  it('covers create, update, close, transfer, deposit and withdraw', () => {
    expect(FINANCIAL_AUDIT_ACTIONS).toEqual(
      new Set([
        AUDIT_ACTIONS.PAYMENT_ACCOUNT_CREATED,
        AUDIT_ACTIONS.PAYMENT_ACCOUNT_UPDATED,
        AUDIT_ACTIONS.PAYMENT_ACCOUNT_CLOSED,
        AUDIT_ACTIONS.PAYMENT_ACCOUNT_TRANSFER,
        AUDIT_ACTIONS.PAYMENT_ACCOUNT_DEPOSIT,
        AUDIT_ACTIONS.PAYMENT_ACCOUNT_WITHDRAWAL,
      ]),
    );
  });

  it('turns an explicit null before/after into Prisma JSON null', () => {
    const data = buildAuditLogData(input);
    expect(data.before).toBe(Prisma.JsonNull);
    expect(data.after).toEqual({ amount: 100 });
    expect(data.action).toBe(AUDIT_ACTIONS.PAYMENT_ACCOUNT_TRANSFER);
  });
});

describe('createAuditLogInTransaction', () => {
  it('writes through the supplied transaction client', async () => {
    const written: unknown[] = [];
    const tx = {
      auditLog: {
        create: async (args: { data: unknown }) => {
          written.push(args.data);
          return args.data;
        },
      },
    };

    await createAuditLogInTransaction(tx as never, input);

    expect(written).toHaveLength(1);
    expect(written[0]).toMatchObject({
      tenantId: 'tenant-1',
      action: AUDIT_ACTIONS.PAYMENT_ACCOUNT_TRANSFER,
    });
  });

  it('propagates the failure so the caller transaction rolls back', async () => {
    const tx = {
      auditLog: {
        create: async () => {
          throw new Error('audit unavailable');
        },
      },
    };

    await expect(createAuditLogInTransaction(tx as never, input)).rejects.toThrow(
      'audit unavailable',
    );
  });
});
