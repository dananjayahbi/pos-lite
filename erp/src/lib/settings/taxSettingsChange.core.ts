/**
 * Tax rate scheduling, versioning and zero-rate confirmation (ARGUS #475).
 *
 * Tax rates feed every sale, yet the settings screen used to write immediately,
 * last-write-wins, with no record of *when* a rate applied and no protection
 * against two managers overwriting each other. Clearing a controlled number
 * input also wrote 0, so a stray Save persisted tax-free sales.
 *
 * The schema has no tax-history table, so the schedule lives in
 * `Tenant.settings` (JSON), which is already the tax store:
 *
 *   vatRate / ssclRate          latest entered rates (what an operator sees)
 *   taxVersion                  monotonic integer used for optimistic locking
 *   taxEffectiveFrom            YYYY-MM-DD the latest entry takes effect
 *   taxUpdatedAt                ISO timestamp of the last write
 *   taxPriorRates               rates that were active before the entry
 *   taxRateHistory              bounded list of prior entries
 *
 * Money resolution stays server-side: `resolveActiveTaxRates` is used by
 * `createSale` (and the appointments engine) so a future-dated rate never
 * charges a sale early. Kept pure so the route, sale engine and UI share it.
 */

export interface TaxRates {
  vatRate: number;
  ssclRate: number;
}

export interface TaxRateHistoryEntry {
  vatRate: number;
  ssclRate: number;
  effectiveFrom: string;
  recordedAt: string;
}

export interface TaxSchedule {
  /** Rates that apply to a sale recorded now. */
  active: TaxRates;
  /** Latest entered rates (may be pending). */
  entered: TaxRates;
  version: number;
  effectiveFrom: string | null;
  updatedAt: string | null;
  /** Non-null when the entered rates start in the future. */
  pending: (TaxRates & { effectiveFrom: string }) | null;
  history: TaxRateHistoryEntry[];
}

export type TaxChangeRejectionCode =
  | 'VERSION_CONFLICT'
  | 'ZERO_RATE_CONFIRMATION_REQUIRED';

export interface TaxChangeRejection {
  code: TaxChangeRejectionCode;
  message: string;
}

export interface TaxChangeInput {
  current: TaxRates;
  currentVersion: number;
  next: TaxRates;
  /** Version the client loaded; omitted by legacy API clients. */
  expectedVersion?: number | null;
  /** Explicit confirmation that a 0% rate is intended. */
  acknowledgeZeroRate?: boolean | null;
  effectiveFrom: string;
  today: string;
}

const MAX_HISTORY = 20;
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

function getSettings(settings: unknown): Record<string, unknown> {
  return typeof settings === 'object' && settings !== null
    ? (settings as Record<string, unknown>)
    : {};
}

function readRate(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function readIsoDate(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return ISO_DATE.test(trimmed) ? trimmed : null;
}

export function todayIso(now: Date = new Date()): string {
  return now.toISOString().slice(0, 10);
}

function readHistory(value: unknown): TaxRateHistoryEntry[] {
  if (!Array.isArray(value)) return [];
  const entries: TaxRateHistoryEntry[] = [];
  for (const raw of value) {
    if (typeof raw !== 'object' || raw === null) continue;
    const entry = raw as Record<string, unknown>;
    const effectiveFrom = readIsoDate(entry.effectiveFrom);
    if (!effectiveFrom) continue;
    entries.push({
      vatRate: readRate(entry.vatRate, 0),
      ssclRate: readRate(entry.ssclRate, 0),
      effectiveFrom,
      recordedAt: typeof entry.recordedAt === 'string' ? entry.recordedAt : '',
    });
  }
  return entries.slice(-MAX_HISTORY);
}

/**
 * Read the full schedule. A tenant that has never used effective dates keeps
 * the legacy behaviour: `vatRate`/`ssclRate` apply immediately.
 */
export function readTaxSchedule(settings: unknown, today: string): TaxSchedule {
  const source = getSettings(settings);
  const entered: TaxRates = {
    vatRate: readRate(source.vatRate, 0),
    ssclRate: readRate(source.ssclRate, 0),
  };
  const effectiveFrom = readIsoDate(source.taxEffectiveFrom);
  const version = readRate(source.taxVersion, 0);
  const updatedAt = typeof source.taxUpdatedAt === 'string' ? source.taxUpdatedAt : null;
  const history = readHistory(source.taxRateHistory);

  let active = entered;
  let pending: TaxSchedule['pending'] = null;

  if (effectiveFrom !== null && effectiveFrom > today) {
    const prior =
      typeof source.taxPriorRates === 'object' && source.taxPriorRates !== null
        ? (source.taxPriorRates as Record<string, unknown>)
        : null;
    active = prior
      ? { vatRate: readRate(prior.vatRate, 0), ssclRate: readRate(prior.ssclRate, 0) }
      : entered;
    pending = { ...entered, effectiveFrom };
  }

  return { active, entered, version, effectiveFrom, updatedAt, pending, history };
}

/** Rates a sale recorded now must charge. Used by the money path. */
export function resolveActiveTaxRates(settings: unknown, now: Date = new Date()): TaxRates {
  return readTaxSchedule(settings, todayIso(now)).active;
}

/**
 * Parse a controlled number input without turning an empty field into 0.
 * Clearing a rate used to write 0 immediately, so Save could persist tax-free
 * sales (ARGUS #475). The form keeps the raw string and blocks Save until it
 * is a real number in range.
 */
export function parseTaxRateInput(raw: string): { value: number | null; error: string | null } {
  const trimmed = raw.trim();
  if (trimmed === '') return { value: null, error: 'Enter a rate between 0 and 100.' };
  const value = Number(trimmed);
  if (!Number.isFinite(value)) return { value: null, error: 'Enter a number between 0 and 100.' };
  if (value < 0 || value > 100) return { value: null, error: 'Rate must be between 0 and 100.' };
  return { value, error: null };
}

/**
 * Server-side guard for a tax write. Returns the rejection to send, or null.
 * The route also serialises the read/validate/write with a row lock so two
 * managers cannot both pass with the same expected version.
 */
export function rejectTaxChange(input: TaxChangeInput): TaxChangeRejection | null {
  if (
    input.expectedVersion !== null &&
    input.expectedVersion !== undefined &&
    input.expectedVersion !== input.currentVersion
  ) {
    return {
      code: 'VERSION_CONFLICT',
      message:
        'These tax rates were changed by someone else while this page was open. Reload and apply your change again.',
    };
  }

  const turnsTaxOff =
    (input.current.vatRate > 0 && input.next.vatRate === 0) ||
    (input.current.ssclRate > 0 && input.next.ssclRate === 0);

  if (turnsTaxOff && input.acknowledgeZeroRate !== true) {
    return {
      code: 'ZERO_RATE_CONFIRMATION_REQUIRED',
      message:
        'A 0% rate makes matching products tax-free from the effective date. Confirm the zero rate before saving.',
    };
  }

  return null;
}

/**
 * The tenant-settings patch for a tax write: new rates, next version, effective
 * date, the previous active rates and a bounded history entry.
 */
export function taxSchedulePatch(input: {
  settings: unknown;
  next: TaxRates;
  effectiveFrom: string;
  today: string;
  now?: Date;
}): {
  settings: Record<string, unknown>;
  version: number;
  audit: { before: TaxRates; after: TaxRates; effectiveFrom: string };
} {
  const source = getSettings(input.settings);
  const schedule = readTaxSchedule(input.settings, input.today);
  const version = schedule.version + 1;
  const now = input.now ?? new Date();

  const history = [
    ...schedule.history,
    {
      vatRate: schedule.active.vatRate,
      ssclRate: schedule.active.ssclRate,
      effectiveFrom: schedule.effectiveFrom ?? input.today,
      recordedAt: now.toISOString(),
    },
  ].slice(-MAX_HISTORY);

  return {
    settings: {
      ...source,
      vatRate: input.next.vatRate,
      ssclRate: input.next.ssclRate,
      taxVersion: version,
      taxEffectiveFrom: input.effectiveFrom,
      taxUpdatedAt: now.toISOString(),
      taxPriorRates: { ...schedule.active },
      taxRateHistory: history,
    },
    version,
    audit: {
      before: schedule.active,
      after: { vatRate: input.next.vatRate, ssclRate: input.next.ssclRate },
      effectiveFrom: input.effectiveFrom,
    },
  };
}
