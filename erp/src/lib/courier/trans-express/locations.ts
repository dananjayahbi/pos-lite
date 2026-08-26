import "server-only";

import { transExpressRequest } from "@/lib/courier/trans-express/client";
import type {
  CourierCity,
  CourierDistrict,
  CourierLocation,
  CourierProvince,
  CourierResult,
} from "@/lib/courier/types";
import type { CourierEnv } from "@/generated/prisma/client";

/**
 * Sync Trans Express master location data: GET /provinces, then per-province
 * GET /districts?province_id=, then per-district GET /cities?district_id=.
 * Tolerant to individual failures (keeps last-known data and continues).
 */

function normalizeLocation(value: unknown): CourierLocation | null {
  if (!value || typeof value !== "object") return null;
  const rec = value as Record<string, unknown>;
  const id = Number(rec.id ?? rec.district_id ?? rec.city_id);
  const text = rec.text ?? rec.name ?? rec.city ?? rec.district;
  if (Number.isNaN(id) || typeof text !== "string" || !text) return null;
  return { id, text };
}

async function fetchDistricts(env: CourierEnv, token: string, provinceId: number): Promise<CourierDistrict[]> {
  const res = await transExpressRequest<unknown[]>(env, `/districts?province_id=${provinceId}`, {
    method: "GET",
    token,
    timeoutMs: 15_000,
  });
  if (!res.ok) return [];
  return res.data
    .map(normalizeLocation)
    .filter((d): d is CourierDistrict => d !== null);
}

async function fetchCities(env: CourierEnv, token: string, districtId: number): Promise<CourierCity[]> {
  const res = await transExpressRequest<unknown[]>(env, `/cities?district_id=${districtId}`, {
    method: "GET",
    token,
    timeoutMs: 15_000,
  });
  if (!res.ok) return [];
  return res.data
    .map(normalizeLocation)
    .filter((c): c is CourierCity => c !== null);
}

export async function transExpressSyncLocations(
  env: CourierEnv,
  token: string,
): Promise<
  CourierResult<{ provinces: CourierProvince[]; districts: CourierDistrict[]; cities: CourierCity[] }>
> {
  const provincesRes = await transExpressRequest<unknown[]>(env, "/provinces", {
    method: "GET",
    token,
    timeoutMs: 15_000,
  });
  if (!provincesRes.ok) {
    return { ok: false, error: provincesRes.error };
  }

  const provinces = provincesRes.data
    .map(normalizeLocation)
    .filter((p): p is CourierProvince => p !== null);

  const districts: CourierDistrict[] = [];
  const cities: CourierCity[] = [];

  for (const province of provinces) {
    const provinceDistricts = await fetchDistricts(env, token, province.id);
    districts.push(...provinceDistricts);
    for (const district of provinceDistricts) {
      const districtCities = await fetchCities(env, token, district.id);
      cities.push(...districtCities);
    }
  }

  return { ok: true, data: { provinces, districts, cities } };
}
