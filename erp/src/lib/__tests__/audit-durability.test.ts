/**
 * M03-02 (NEW-A) — writeAuditLog durability contract: a failed SECURITY audit
 * write must surface (rethrow → route 500), never vanish silently.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  create: vi.fn(),
}));

vi.mock('@/lib/prisma', () => ({
  prisma: {
    auditLog: { create: mocks.create },
  },
}));

vi.mock('@sentry/nextjs', () => ({
  captureException: vi.fn(),
}));

import { writeAuditLog, AUDIT_ACTIONS } from '@/lib/services/audit.service';

const entry = {
  tenantId: 'tenant-1',
  actorId: 'owner-1',
  actorRole: 'OWNER',
  entityType: 'Staff',
  entityId: 'staff-1',
  action: AUDIT_ACTIONS.STAFF_ROLE_CHANGED,
};

describe('writeAuditLog (M03-02 durability)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('writes the row on success', async () => {
    mocks.create.mockResolvedValue({});
    await expect(writeAuditLog(entry)).resolves.toBeUndefined();
    expect(mocks.create).toHaveBeenCalledTimes(1);
    const data = mocks.create.mock.calls[0]?.[0]?.data;
    expect(data.actorId).toBe('owner-1');
    expect(data.actorRole).toBe('OWNER');
  });

  it('RETHROWS when the audit write fails (route must 500, not fake success)', async () => {
    const failure = new Error('db down');
    mocks.create.mockRejectedValue(failure);
    await expect(writeAuditLog(entry)).rejects.toBe(failure);
  });

  it('logs the failure server-side (console.error) before rethrowing', async () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    mocks.create.mockRejectedValue(new Error('db down'));
    await expect(writeAuditLog(entry)).rejects.toThrow('db down');
    expect(spy).toHaveBeenCalledWith(
      expect.stringContaining('SECURITY audit log write failed'),
      expect.anything(),
      expect.any(Error),
    );
    spy.mockRestore();
  });
});
