/**
 * Customer Contact Export — Configuration.
 *
 * Reads delivery destination, format, scope, and schedule from environment
 * variables (consistent with how other cron jobs are configured). All values
 * have safe defaults so the job runs without special setup.
 */
import type {
  ContactExportFormat,
  ContactExportScope,
} from '@/lib/services/customer-contact-export-core';

/** Where a finished export is delivered. */
export type ContactExportDestination = 'export-dir' | 'email' | 'none';

export interface ContactExportConfig {
  /** Output file format: `csv` or `xlsx`. Default `csv`. */
  format: ContactExportFormat;
  /** Default scope for scheduled runs. Default `ALL`. */
  scope: ContactExportScope;
  /** Recency window (days) for ACTIVE / NEW scopes. Default `90`. */
  activeDays: number;
  /** Delivery destination. Default `export-dir`. */
  destination: ContactExportDestination;
  /** Recipient email when destination is `email`. */
  email: string | null;
  /** Directory to write files into when destination is `export-dir`. */
  exportDir: string;
  /** Whether the job is enabled at all. Default `true`. */
  enabled: boolean;
}

function parseScope(raw: string | undefined): ContactExportScope {
  switch (raw?.toUpperCase()) {
    case 'ACTIVE':
      return 'ACTIVE';
    case 'NEW':
      return 'NEW';
    case 'REPEAT':
      return 'REPEAT';
    default:
      return 'ALL';
  }
}

function parseFormat(raw: string | undefined): ContactExportFormat {
  return raw?.toLowerCase() === 'xlsx' ? 'xlsx' : 'csv';
}

function parseDestination(raw: string | undefined): ContactExportDestination {
  switch (raw?.toLowerCase()) {
    case 'email':
      return 'email';
    case 'none':
      return 'none';
    default:
      return 'export-dir';
  }
}

function parsePositiveInt(raw: string | undefined, fallback: number): number {
  const value = Number(raw);
  return Number.isFinite(value) && value > 0 ? Math.floor(value) : fallback;
}

export function getContactExportConfig(env: NodeJS.ProcessEnv = process.env): ContactExportConfig {
  return {
    format: parseFormat(env.CONTACT_EXPORT_FORMAT),
    scope: parseScope(env.CONTACT_EXPORT_SCOPE),
    activeDays: parsePositiveInt(env.CONTACT_EXPORT_ACTIVE_DAYS, 90),
    destination: parseDestination(env.CONTACT_EXPORT_DESTINATION),
    email: env.CONTACT_EXPORT_EMAIL || null,
    exportDir: env.CONTACT_EXPORT_DIR || './exports',
    enabled: env.CONTACT_EXPORT_ENABLED !== 'false',
  };
}

/** Readable schedule string (informational only) from env. */
export function getContactExportSchedule(env: NodeJS.ProcessEnv = process.env): string {
  return env.CONTACT_EXPORT_SCHEDULE === 'weekly' ? 'weekly' : 'daily';
}
