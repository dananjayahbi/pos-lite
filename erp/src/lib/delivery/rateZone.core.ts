/**
 * Rate-card zone validation and matching (ARGUS #290).
 *
 * The editor used to take raw numeric destination ids with no names, while
 * `RateCardEntry.originDistrictId` was stored but never read by the pricing
 * engine, so an "origin-specific" override silently applied to every origin.
 *
 * The data model has no origin on a delivery/shipment, so origin-scoped pricing
 * is not supported. These pure helpers:
 *  - reject any non-null origin on save (no silent global application),
 *  - validate destination ids against the synced courier master list when one
 *    is available, and
 *  - let the UI flag/remove rows left over from the old origin-blind editor.
 */

export interface RateZoneEntryLike {
  originDistrictId?: number | null | undefined;
  destinationDistrictId?: number | null | undefined;
  destinationCityId?: number | null | undefined;
  baseRate?: number | null | undefined;
  extraKgRate?: number | null | undefined;
}

export type RateZoneField =
  | 'originDistrictId'
  | 'destinationDistrictId'
  | 'destinationCityId';

export interface RateZoneValidationError {
  index: number;
  field: RateZoneField;
  message: string;
}

export interface RateZoneValidationContext {
  /** Synced courier district ids; an empty list disables existence checks. */
  districtIds?: number[] | undefined;
  /** Synced courier city ids; an empty list disables existence checks. */
  cityIds?: number[] | undefined;
}

export const ORIGIN_NOT_SUPPORTED_MESSAGE =
  'Origin-specific rates are not supported. Leave origin empty; zone rates match the destination only.';

/** True for a row that still targets a specific origin. */
export function isOriginSpecificZone(entry: RateZoneEntryLike): boolean {
  return entry.originDistrictId !== null && entry.originDistrictId !== undefined;
}

export function originSpecificEntryCount(entries: RateZoneEntryLike[]): number {
  return entries.filter(isOriginSpecificZone).length;
}

/** Drop legacy origin-specific rows before saving the destination-only matrix. */
export function withoutOriginSpecificEntries<T extends RateZoneEntryLike>(entries: T[]): T[] {
  return entries.filter((entry) => !isOriginSpecificZone(entry));
}

export const DUPLICATE_ZONE_MESSAGE =
  'Another row already targets this destination. Keep one row per district/city pair.';
export const BLANK_ZONE_MESSAGE =
  'This row has no destination and no rates. Remove it or fill in a destination.';

function valueOrAny(value: number | null | undefined): string {
  return value === null || value === undefined ? 'any' : String(value);
}

/** Identity of a destination (null means "any" at that level). */
export function rateZoneKey(entry: RateZoneEntryLike): string {
  return `${valueOrAny(entry.destinationDistrictId)}|${valueOrAny(entry.destinationCityId)}`;
}

/** A row added by the UI and never filled in. */
export function isBlankRateZoneEntry(entry: RateZoneEntryLike): boolean {
  return (
    (entry.originDistrictId === null || entry.originDistrictId === undefined) &&
    (entry.destinationDistrictId === null || entry.destinationDistrictId === undefined) &&
    (entry.destinationCityId === null || entry.destinationCityId === undefined) &&
    (entry.baseRate === null || entry.baseRate === undefined) &&
    (entry.extraKgRate === null || entry.extraKgRate === undefined)
  );
}

/** Indexes whose destination already appeared on an earlier row. */
export function duplicateRateZoneIndexes(entries: RateZoneEntryLike[]): number[] {
  const seen = new Set<string>();
  const duplicates: number[] = [];
  entries.forEach((entry, index) => {
    const key = rateZoneKey(entry);
    if (seen.has(key)) duplicates.push(index);
    else seen.add(key);
  });
  return duplicates;
}

export function validateRateZoneEntries(
  entries: RateZoneEntryLike[],
  context: RateZoneValidationContext = {},
): RateZoneValidationError[] {
  const districts = new Set(context.districtIds ?? []);
  const cities = new Set(context.cityIds ?? []);
  const errors: RateZoneValidationError[] = [];
  const duplicates = new Set(duplicateRateZoneIndexes(entries));

  entries.forEach((entry, index) => {
    if (duplicates.has(index)) {
      errors.push({
        index,
        field: 'destinationCityId',
        message: DUPLICATE_ZONE_MESSAGE,
      });
    }
    if (isBlankRateZoneEntry(entry)) {
      errors.push({
        index,
        field: 'destinationCityId',
        message: BLANK_ZONE_MESSAGE,
      });
    }
    if (isOriginSpecificZone(entry)) {
      errors.push({ index, field: 'originDistrictId', message: ORIGIN_NOT_SUPPORTED_MESSAGE });
    }
    if (
      districts.size > 0 &&
      entry.destinationDistrictId !== null &&
      entry.destinationDistrictId !== undefined &&
      !districts.has(entry.destinationDistrictId)
    ) {
      errors.push({
        index,
        field: 'destinationDistrictId',
        message: 'District not found in the synced courier locations.',
      });
    }
    if (
      cities.size > 0 &&
      entry.destinationCityId !== null &&
      entry.destinationCityId !== undefined &&
      !cities.has(entry.destinationCityId)
    ) {
      errors.push({
        index,
        field: 'destinationCityId',
        message: 'City not found in the synced courier locations.',
      });
    }
  });

  return errors;
}
