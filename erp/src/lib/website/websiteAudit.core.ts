/**
 * Website CMS audit records (ARGUS #498).
 *
 * Every destructive CMS write must record the real actor and a before/after
 * snapshot. The old config upsert wrote an after-only row with actorRole
 * hard-coded to OWNER; slide/ad create/update/delete, the config's slide/ad
 * replacement and the full reset wrote nothing.
 *
 * Pure so the JSON snapshot shape (dates, prisma objects, undefined values) is
 * tested without a database.
 */
import type { Prisma } from '@/generated/prisma/client';
import type { CreateAuditLogInput } from '@/lib/services/audit.service';

export interface WebsiteAuditActor {
  id: string;
  role: string;
}

/** JSON-safe snapshot for an audit row; undefined becomes null. */
export function serializeWebsiteAudit(value: unknown): Prisma.InputJsonValue | null {
  if (value === undefined || value === null) return null;
  try {
    return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
  } catch {
    return null;
  }
}

export interface WebsiteAuditRecordInput {
  tenantId: string;
  actor: WebsiteAuditActor;
  entityType: string;
  entityId: string;
  action: string;
  before?: unknown;
  after?: unknown;
}

/** Build the durable audit row passed to `writeAuditLog`. */
export function websiteAuditRecord(input: WebsiteAuditRecordInput): CreateAuditLogInput {
  return {
    tenantId: input.tenantId,
    actorId: input.actor.id,
    actorRole: input.actor.role,
    entityType: input.entityType,
    entityId: input.entityId,
    action: input.action,
    before: serializeWebsiteAudit(input.before),
    after: serializeWebsiteAudit(input.after),
  };
}
