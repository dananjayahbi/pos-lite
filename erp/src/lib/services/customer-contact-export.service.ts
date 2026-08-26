/**
 * Customer Contact Export — Service.
 *
 * Orchestrates an export run: queries customer/order data from Prisma, maps it
 * to the export contract, applies scope + exclusion rules + phone dedup via the
 * pure core module, renders CSV/XLSX, delivers to the configured destination,
 * and records an audit trail. Query and rendering stay in separate modules so
 * either can change independently.
 */
import { mkdir, writeFile } from 'fs/promises';
import { join } from 'path';
import { prisma } from '@/lib/prisma';
import { createAuditLog } from '@/lib/services/audit.service';
import {
  buildContactRows,
  buildExportFilename,
  renderContactsCSV,
  renderContactsXLSX,
  type ContactCandidate,
  type ContactExportScope,
  type ScopeFilterOptions,
} from '@/lib/services/customer-contact-export-core';
import {
  getContactExportConfig,
  type ContactExportConfig,
} from '@/lib/services/customer-contact-export.config';

/** Audit action recorded for every scheduled or ad-hoc export run. */
export const CONTACT_EXPORT_ACTION = 'CONTACT_EXPORT_RUN';

/** Audit entity type used for contact export events. */
export const CONTACT_EXPORT_ENTITY = 'CUSTOMER_CONTACT_EXPORT';

export interface ContactExportRunOptions {
  tenantId: string;
  /** Override the configured scope for this run (ad-hoc). */
  scope?: ContactExportScope | undefined;
  /** Override the configured active-days window. */
  activeDays?: number | undefined;
  /** Trigger source for the audit log. */
  actorRole?: string | undefined;
  actorId?: string | null | undefined;
  /** Reference time for recency (mainly for tests). */
  now?: Date | undefined;
}

export interface ContactExportCompiled {
  tenantId: string;
  scope: ContactExportScope;
  format: string;
  totalCandidates: number;
  included: number;
  excluded: number;
  filename: string;
  content: string | Buffer;
  createdAt: string;
}

export interface ContactExportRunResult extends Omit<ContactExportCompiled, 'content' | 'filename'> {
  filename: string | null;
  destination: string;
  deliveredTo: string | null;
}

/**
 * Query, filter, deduplicate, and render an export for a tenant — without
 * delivering it. Used by the ad-hoc download route and reused by the delivery
 * run below so the file returned to a user and the file emailed/written by the
 * cron job are produced identically.
 */
export async function compileCustomerContactExport(
  options: ContactExportRunOptions,
): Promise<ContactExportCompiled> {
  const now = options.now ?? new Date();
  const config = getContactExportConfig();

  // Effective scope: ad-hoc override wins over the configured default.
  const scope: ContactExportScope = options.scope ?? config.scope;
  const scopeOptions: ScopeFilterOptions = {
    scope,
    activeDays: options.activeDays ?? config.activeDays,
    now,
  };

  // ── Query customer/order data (single pass, no N+1) ───────────────────────
  const customers = await prisma.customer.findMany({
    where: { tenantId: options.tenantId },
    include: {
      _count: { select: { sales: true } },
      tenant: { select: { name: true } },
    },
  });

  const candidates: ContactCandidate[] = customers.map((customer) => ({
    id: customer.id,
    name: customer.name,
    phone: customer.phone,
    email: customer.email,
    tags: customer.tags,
    isActive: customer.isActive,
    deletedAt: customer.deletedAt,
    createdAt: customer.createdAt,
    totalSpend: customer.totalSpend,
    lastPurchaseAt: customer.lastPurchaseAt,
    orderCount: customer._count.sales,
    tenantName: customer.tenant.name,
  }));

  const { rows, included, excluded } = buildContactRows(candidates, scopeOptions);

  // ── Render file ────────────────────────────────────────────────────────────
  const format = config.format;
  const filename = buildExportFilename(format, now);
  const content = format === 'xlsx' ? renderContactsXLSX(rows) : renderContactsCSV(rows);

  return {
    tenantId: options.tenantId,
    scope,
    format,
    totalCandidates: customers.length,
    included,
    excluded,
    filename,
    content,
    createdAt: now.toISOString(),
  };
}

/**
 * Run a full contact export for a tenant: compiles the file, delivers it per the
 * effective config, and writes an audit log entry (audit failures are swallowed
 * per convention; delivery/query errors surface to the caller).
 */
export async function runCustomerContactExport(
  options: ContactExportRunOptions,
): Promise<ContactExportRunResult> {
  const compiled = await compileCustomerContactExport(options);
  const config = getContactExportConfig();

  const { deliveredTo } = await deliverContactExport({
    config,
    filename: compiled.filename,
    content: compiled.content,
    rowCount: compiled.included,
  });

  // ── Audit trail ────────────────────────────────────────────────────────────
  await createAuditLog({
    tenantId: options.tenantId,
    actorId: options.actorId ?? null,
    actorRole: options.actorRole ?? 'SYSTEM',
    entityType: CONTACT_EXPORT_ENTITY,
    entityId: `${options.tenantId}:${compiled.createdAt}`,
    action: CONTACT_EXPORT_ACTION,
    after: {
      scope: compiled.scope,
      format: compiled.format,
      totalCandidates: compiled.totalCandidates,
      included: compiled.included,
      excluded: compiled.excluded,
      destination: config.destination,
      deliveredTo,
    },
  });

  return {
    tenantId: options.tenantId,
    scope: compiled.scope,
    format: compiled.format,
    totalCandidates: compiled.totalCandidates,
    included: compiled.included,
    excluded: compiled.excluded,
    filename: deliveredTo ? compiled.filename : null,
    destination: config.destination,
    deliveredTo,
    createdAt: compiled.createdAt,
  };
}

// ── Delivery ─────────────────────────────────────────────────────────────────

interface DeliverInput {
  config: ContactExportConfig;
  filename: string;
  content: string | Buffer;
  rowCount: number;
}

async function deliverContactExport(input: DeliverInput): Promise<{ deliveredTo: string | null }> {
  const { config } = input;

  if (config.destination === 'none') {
    return { deliveredTo: null };
  }

  if (config.destination === 'email') {
    if (!config.email) {
      return { deliveredTo: null };
    }
    const ok = await sendContactExportEmail(input);
    return { deliveredTo: ok ? config.email : null };
  }

  // default: write into the export directory
  const destination = join(config.exportDir, input.filename);
  await mkdir(config.exportDir, { recursive: true });
  await writeFile(destination, input.content);
  return { deliveredTo: destination };
}

/** Email the export as an attachment via Resend (falls back to no-op without key). */
async function sendContactExportEmail(input: DeliverInput): Promise<boolean> {
  const apiKey = process.env.RESEND_API_KEY;
  const email = input.config.email;
  if (!apiKey || !email) return false;

  const { Resend } = await import('resend');
  const resend = new Resend(apiKey);
  const from = process.env.EMAIL_FROM_ADDRESS || 'noreply@ayurpos.dev';
  const filename = input.filename;
  const attachmentContent =
    typeof input.content === 'string'
      ? Buffer.from(input.content, 'utf-8')
      : input.content;

  const subject = `Customer contact export — ${input.rowCount} contacts`;

  try {
    await resend.emails.send({
      from,
      to: email,
      subject,
      html: `
        <p>Your customer contact export is ready.</p>
        <p><strong>${input.rowCount}</strong> contacts exported at
        <strong>${new Date().toISOString()}</strong>.</p>
        <p>The file <code>${filename}</code> is attached.</p>
      `,
      attachments: [{ filename, content: attachmentContent }],
    });
    return true;
  } catch (error) {
    console.error('[customer-contact-export] Email delivery failed:', error);
    return false;
  }
}
