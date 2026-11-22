/**
 * Shape of an appointment service as returned by
 * `GET /api/store/appointments/services`. Prisma serialises `Decimal` fields as
 * strings over JSON, so `price` accepts the raw number or string form.
 */
export interface AppointmentServiceRecord {
  id: string;
  name: string;
  description: string | null;
  durationMins: number;
  price: number | string | { toString(): string };
  /** Tax treatment used when the appointment is converted (ARGUS #131). */
  taxRule?: 'STANDARD_VAT' | 'SSCL' | 'EXEMPT' | null;
  color: string | null;
  isActive: boolean;
  sortOrder: number;
}

export type ServiceStatusFilter = 'all' | 'active' | 'inactive';

export interface ServiceCatalogFilters {
  search?: string;
  status?: ServiceStatusFilter;
}

export interface ServiceCatalogSummary {
  total: number;
  active: number;
  inactive: number;
  /** Mean duration rounded to the nearest minute; 0 for an empty catalogue. */
  averageDurationMins: number;
  /** Lowest/highest price, or null when the catalogue is empty. */
  lowestPrice: number | null;
  highestPrice: number | null;
}

/** Normalise a Prisma Decimal / string / number price into a number. */
export function toServicePrice(price: AppointmentServiceRecord['price'] | null | undefined): number {
  if (price == null) return 0;
  if (typeof price === 'number') return price;
  if (typeof price === 'string') {
    const parsed = Number(price);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  const parsed = Number(price.toString());
  return Number.isFinite(parsed) ? parsed : 0;
}

/**
 * Filter the catalogue for the services screen. Search matches the service
 * name and description case-insensitively; blank searches match everything.
 */
export function filterAppointmentServices<T extends AppointmentServiceRecord>(
  services: readonly T[],
  filters: ServiceCatalogFilters = {},
): T[] {
  const term = (filters.search ?? '').trim().toLowerCase();
  const status = filters.status ?? 'all';

  return services.filter((service) => {
    if (status === 'active' && !service.isActive) return false;
    if (status === 'inactive' && service.isActive) return false;
    if (!term) return true;
    return (
      service.name.toLowerCase().includes(term) ||
      (service.description ?? '').toLowerCase().includes(term)
    );
  });
}

/** Aggregate numbers for the summary strip above the catalogue. */
export function summarizeAppointmentServices(
  services: readonly AppointmentServiceRecord[],
): ServiceCatalogSummary {
  if (services.length === 0) {
    return {
      total: 0,
      active: 0,
      inactive: 0,
      averageDurationMins: 0,
      lowestPrice: null,
      highestPrice: null,
    };
  }

  let active = 0;
  let durationTotal = 0;
  let lowestPrice = Number.POSITIVE_INFINITY;
  let highestPrice = Number.NEGATIVE_INFINITY;

  for (const service of services) {
    if (service.isActive) active += 1;
    durationTotal += service.durationMins;
    const price = toServicePrice(service.price);
    if (price < lowestPrice) lowestPrice = price;
    if (price > highestPrice) highestPrice = price;
  }

  return {
    total: services.length,
    active,
    inactive: services.length - active,
    averageDurationMins: Math.round(durationTotal / services.length),
    lowestPrice,
    highestPrice,
  };
}
