/**
 * Rate-preview request/state rules (ARGUS #291).
 *
 * The Create Delivery estimate used to send only weight + city, skipped the
 * district (so district-only overrides were never previewed), and kept a stale
 * amount after the weight/city was cleared. These pure helpers decide when a
 * preview can be requested and what the UI should show.
 */

export interface RatePreviewInputs {
  weightKg?: number | null | undefined;
  destinationCityId?: number | null | undefined;
  destinationDistrictId?: number | null | undefined;
}

export interface RatePreviewRequest {
  weightKg: number;
  destinationDistrictId?: number;
  destinationCityId?: number;
}

function positiveInt(value: number | null | undefined): number | undefined {
  if (value === null || value === undefined) return undefined;
  if (!Number.isInteger(value) || value <= 0) return undefined;
  return value;
}

/**
 * Build the preview payload, or `null` when it cannot be computed.
 *
 * A meaningful estimate needs a positive weight AND at least one resolved
 * destination (city or district). District-only is valid because the saved fee
 * uses both ids and a district override may match without a city.
 */
export function buildRatePreviewRequest(input: RatePreviewInputs): RatePreviewRequest | null {
  const weight = Number(input.weightKg);
  if (!Number.isFinite(weight) || weight <= 0) return null;

  const destinationDistrictId = positiveInt(input.destinationDistrictId);
  const destinationCityId = positiveInt(input.destinationCityId);
  if (destinationDistrictId === undefined && destinationCityId === undefined) return null;

  return {
    weightKg: weight,
    ...(destinationDistrictId !== undefined ? { destinationDistrictId } : {}),
    ...(destinationCityId !== undefined ? { destinationCityId } : {}),
  };
}

export type RatePreviewState =
  | 'incomplete'
  | 'loading'
  | 'error'
  | 'not-configured'
  | 'ready';

export function resolveRatePreviewState(input: {
  request: RatePreviewRequest | null;
  isPending: boolean;
  isError: boolean;
  data: { configured?: boolean | undefined } | null | undefined;
}): RatePreviewState {
  if (!input.request) return 'incomplete';
  if (input.isError) return 'error';
  if (input.isPending) return 'loading';
  if (input.data?.configured === false) return 'not-configured';
  if (input.data) return 'ready';
  return 'incomplete';
}
