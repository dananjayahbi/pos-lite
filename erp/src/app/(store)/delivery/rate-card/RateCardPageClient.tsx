'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { standardSchemaResolver } from '@hookform/resolvers/standard-schema';
import { AlertTriangle } from 'lucide-react';
import { useRateCard, useLocations } from '@/hooks/delivery';
import { usePermissions } from '@/hooks/usePermissions';
import { PERMISSIONS } from '@/lib/constants/permissions';
import { originSpecificEntryCount, withoutOriginSpecificEntries, validateRateZoneEntries } from '@/lib/delivery/rateZone.core';
import {
  UpsertRateCardSchema,
} from '@/lib/validators/ratecard.validators';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { RateMatrixTable } from '@/components/delivery/rate-card/RateMatrixTable';
import { rateCardLoadState } from '@/components/delivery/rate-card/rateCardLoadState';
import { rateCardMetaSummary } from '@/lib/delivery/rateCardMeta.core';

interface RateEntry {
  id?: string;
  originDistrictId?: number | null;
  destinationDistrictId?: number | null;
  destinationCityId?: number | null;
  baseRate?: number | null;
  extraKgRate?: number | null;
}

interface RateCardData {
  name?: string;
  baseRate?: number | string;
  extraKgRate?: number | string;
  freeBaseWeightKg?: number | string;
  coddCommissionPct?: number | string | null;
  vatRatePct?: number | string | null;
  entries?: RateEntry[];
}

function toNumber(value: number | string | null | undefined): number | undefined {
  if (value === null || value === undefined) return undefined;
  const num = Number(value);
  return Number.isNaN(num) ? undefined : num;
}

/**
 * Form defaults for an existing card. Undefined numerics are omitted rather
 * than written as `undefined` (exactOptionalPropertyTypes) — the required-field
 * validator then insists the operator types a value before saving.
 */
function rateCardFormDefaults(card: RateCardData | null) {
  const baseRate = toNumber(card?.baseRate);
  const extraKgRate = toNumber(card?.extraKgRate);
  const freeBaseWeightKg = toNumber(card?.freeBaseWeightKg);
  const coddCommissionPct = toNumber(card?.coddCommissionPct);
  const vatRatePct = toNumber(card?.vatRatePct);

  return {
    name: card?.name ?? 'Trans Express Standard',
    ...(baseRate !== undefined ? { baseRate } : {}),
    ...(extraKgRate !== undefined ? { extraKgRate } : {}),
    ...(freeBaseWeightKg !== undefined ? { freeBaseWeightKg } : {}),
    ...(coddCommissionPct !== undefined ? { coddCommissionPct } : {}),
    ...(vatRatePct !== undefined ? { vatRatePct } : {}),
  };
}

/**
 * ARGUS #289: the base/extra/free fields are required and receive real
 * numbers (`valueAsNumber`), so clearing an input produces NaN and fails
 * validation instead of silently coercing to 0. COD/VAT stay optional but an
 * emptied input maps to `undefined` (omitted from the PUT), never 0.
 */
const RateCardFormSchema = UpsertRateCardSchema.extend({
  name: z.string().trim().min(1, 'Rate card name is required').max(120),
  baseRate: z.number({ error: 'Base rate is required' }).nonnegative('Base rate cannot be negative'),
  extraKgRate: z
    .number({ error: 'Extra kg rate is required' })
    .nonnegative('Extra kg rate cannot be negative'),
  freeBaseWeightKg: z
    .number({ error: 'Free base weight is required' })
    .nonnegative('Free base weight cannot be negative'),
  coddCommissionPct: z
    .union([
      z.number({ error: 'Enter a valid COD commission' }).nonnegative('Cannot be negative'),
      z.nan().transform(() => undefined),
    ])
    .optional(),
  vatRatePct: z
    .union([
      z.number({ error: 'Enter a valid VAT rate' }).nonnegative('Cannot be negative'),
      z.nan().transform(() => undefined),
    ])
    .optional(),
});

export function RateCardPageClient() {
  const { hasPermission, isLoading: permissionsLoading } = usePermissions();
  const canManage = hasPermission(PERMISSIONS.DELIVERY.manageRateCard);
  const { data, meta, isLoading, isError, error, isFetching, refetch, save, saveEntries } =
    useRateCard();
  const { data: locations } = useLocations();
  const districts = locations?.districts ?? [];
  const cities = locations?.cities ?? [];

  const card = useMemo(() => (data as RateCardData | undefined) ?? null, [data]);
  const loadState = rateCardLoadState({ isLoading, isError, data: data ?? null });
  const isCreate = loadState === 'not-found';
  const initialEntries = card?.entries ?? [];
  const hydrated = useRef(false);

  const [entries, setEntries] = useState<RateEntry[]>(initialEntries);
  const originSpecificCount = originSpecificEntryCount(entries);
  const zoneErrors = validateRateZoneEntries(entries);
  const hasZoneErrors = zoneErrors.length > 0;

  // Hydrate the zone matrix once from the loaded rate card.
  useEffect(() => {
    if (hydrated.current) return;
    if (loadState !== 'ready' || !card) return;
    hydrated.current = true;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setEntries(card.entries ?? []);
  }, [loadState, card]);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<
    z.input<typeof RateCardFormSchema>,
    unknown,
    z.output<typeof RateCardFormSchema>
  >({
    resolver: standardSchemaResolver(RateCardFormSchema),
    defaultValues: rateCardFormDefaults(card),
  });

  // M25-02 (BUG-63): `defaultValues` are computed once from an initially-null
  // card. Re-seed only after a real card has loaded — a failed GET must never
  // overwrite live values (ARGUS #289).
  useEffect(() => {
    if (loadState !== 'ready' || !card) return;
    reset(rateCardFormDefaults(card));
  }, [loadState, card, reset]);

  // M25-02: a synchronous latch (a ref, not React state) blocks the second
  // click of a double-click before the mutation's isPending state can react.
  const submittingRef = useRef(false);

  if (permissionsLoading) {
    return (
      <div className="grid gap-4 sm:grid-cols-2">
        {Array.from({ length: 6 }).map((_, index) => (
          <Skeleton key={index} className="h-16 w-full" />
        ))}
      </div>
    );
  }

  if (!canManage) {
    return (
      <Card className="border-mist">
        <CardContent className="p-8 text-center text-sm text-espresso/60">
          You do not have permission to manage the delivery rate card.
        </CardContent>
      </Card>
    );
  }

  const onSave = (formData: z.output<typeof RateCardFormSchema>) => {
    // ARGUS #289: never submit from the error/loading states.
    if (loadState !== 'ready' && loadState !== 'not-found') return;
    // M25-02: ignore a second submit that lands while the latch is held.
    if (submittingRef.current) return;
    submittingRef.current = true;
    const body: Record<string, unknown> = { ...formData };
    // The API creates the first card when none exists; that is only valid in
    // the explicit not-found state (loadState === 'not-found').
    save.mutate(body, { onSettled: () => { submittingRef.current = false; } });
  };

  const onSaveEntries = () => {
    if (loadState !== 'ready') return;
    if (hasZoneErrors) return;
    if (submittingRef.current) return;
    submittingRef.current = true;
    saveEntries.mutate(entries, { onSettled: () => { submittingRef.current = false; } });
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold text-espresso">Delivery Rate Card</h1>
        <p className="text-sm text-espresso/60">
          Base Trans Express pricing and zone-level overrides for COD deliveries.
        </p>
        <p className="mt-1 text-xs text-espresso/50" data-testid="rate-card-meta">
          {rateCardMetaSummary(meta)}
        </p>
      </div>

      <Card className="border-mist">
        <CardHeader>
          <CardTitle className="font-display text-lg">Base Rate</CardTitle>
          <CardDescription>
            {isCreate
              ? 'No rate card is configured yet. Fill in every required field to create the first one.'
              : 'Applied when no zone override matches. All amounts are in Rupees (Rs).'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loadState === 'loading' ? (
            <div className="grid gap-4 sm:grid-cols-2">
              {Array.from({ length: 6 }).map((_, index) => (
                <Skeleton key={index} className="h-16 w-full" />
              ))}
            </div>
          ) : loadState === 'error' ? (
            <div
              role="alert"
              className="flex flex-col gap-4 rounded-lg border border-terracotta/30 bg-terracotta/5 p-4 sm:flex-row sm:items-start sm:justify-between"
            >
              <div className="flex items-start gap-3">
                <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-terracotta" />
                <div>
                  <p className="font-body text-sm font-medium text-espresso">
                    Could not load the rate card
                  </p>
                  <p className="mt-1 font-body text-sm text-espresso/70">
                    {error instanceof Error
                      ? error.message
                      : 'The current rates could not be fetched.'}
                  </p>
                  <p className="mt-1 font-body text-xs text-espresso/50">
                    Saving is disabled until the real card loads, so a failed request cannot
                    overwrite your live pricing.
                  </p>
                </div>
              </div>
              <Button
                type="button"
                variant="outline"
                onClick={() => void refetch()}
                disabled={isFetching}
                className="shrink-0"
              >
                {isFetching ? 'Retrying…' : 'Retry'}
              </Button>
            </div>
          ) : (
            /* eslint-disable-next-line react-hooks/refs */
            <form onSubmit={handleSubmit(onSave)} className="space-y-4">
              {isCreate && (
                <div className="rounded-lg border border-sand bg-linen/60 px-3 py-2 font-body text-sm text-espresso/70">
                  This will create the tenant&apos;s first delivery rate card. Numeric fields are
                  required - an empty field will not be saved as 0.
                </div>
              )}
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="rate-name">Name</Label>
                  <Input id="rate-name" {...register('name')} placeholder="Trans Express Standard" />
                  {errors.name && (
                    <p className="text-sm text-terracotta">{errors.name.message}</p>
                  )}
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="rate-base">Base Rate (Rs)</Label>
                  <Input
                    id="rate-base"
                    type="number"
                    step="any"
                    min={0}
                    {...register('baseRate', { valueAsNumber: true })}
                    placeholder="0.00"
                  />
                  {errors.baseRate && (
                    <p className="text-sm text-terracotta">{errors.baseRate.message}</p>
                  )}
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="rate-extra">Extra Kg Rate (Rs)</Label>
                  <Input
                    id="rate-extra"
                    type="number"
                    step="any"
                    min={0}
                    {...register('extraKgRate', { valueAsNumber: true })}
                    placeholder="0.00"
                  />
                  {errors.extraKgRate && (
                    <p className="text-sm text-terracotta">{errors.extraKgRate.message}</p>
                  )}
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="rate-free">Free Base Weight (kg)</Label>
                  <Input
                    id="rate-free"
                    type="number"
                    step="any"
                    min={0}
                    {...register('freeBaseWeightKg', { valueAsNumber: true })}
                    placeholder="1"
                  />
                  {errors.freeBaseWeightKg && (
                    <p className="text-sm text-terracotta">{errors.freeBaseWeightKg.message}</p>
                  )}
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="rate-codd">COD Commission (%)</Label>
                  <Input
                    id="rate-codd"
                    type="number"
                    step="any"
                    min={0}
                    {...register('coddCommissionPct', { valueAsNumber: true })}
                    placeholder="0.00"
                  />
                  <p className="text-espresso/50 text-xs">
                    Charged on the cash collected (gross COD).
                  </p>
                  {errors.coddCommissionPct && (
                    <p className="text-sm text-terracotta">{errors.coddCommissionPct.message}</p>
                  )}
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="rate-vat">VAT on Service Fees (%)</Label>
                  <Input
                    id="rate-vat"
                    type="number"
                    step="any"
                    min={0}
                    {...register('vatRatePct', { valueAsNumber: true })}
                    placeholder="0.00"
                  />
                  <p className="text-espresso/50 text-xs">
                    Applied to the delivery fee + COD commission, not to the cash collected.
                  </p>
                  {errors.vatRatePct && (
                    <p className="text-sm text-terracotta">{errors.vatRatePct.message}</p>
                  )}
                </div>
              </div>

              <div className="flex justify-end">
                <Button
                  type="submit"
                  disabled={save.isPending}
                >
                  {save.isPending ? 'Saving...' : isCreate ? 'Create Rate Card' : 'Save Rate Card'}
                </Button>
              </div>
            </form>
          )}
        </CardContent>
      </Card>

      {loadState === 'ready' && (
        <Card className="border-mist">
          <CardHeader>
            <CardTitle className="font-display text-lg">Zone Overrides</CardTitle>
            <CardDescription>
              Destination-specific rates. Leave a field empty to fall back to the base rate.
              Origin-based pricing is not supported.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {hasZoneErrors ? (
              <div
                role="alert"
                className="mb-4 rounded-lg border border-terracotta/30 bg-terracotta/5 p-3 text-sm text-terracotta"
                data-testid="rate-zone-errors"
              >
                <p className="font-medium">Fix these zone rows before saving</p>
                <ul className="mt-1 space-y-0.5 text-xs">
                  {zoneErrors.map((error) => (
                    <li key={`${error.index}-${error.field}-${error.message}`}>
                      Row {error.index + 1}: {error.message}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
            {originSpecificCount > 0 ? (
              <div
                role="alert"
                className="mb-4 flex flex-col gap-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900 sm:flex-row sm:items-start sm:justify-between"
              >
                <div className="flex items-start gap-2">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                  <div>
                    <p className="font-medium">
                      {originSpecificCount} row{originSpecificCount === 1 ? '' : 's'} target a
                      specific origin
                    </p>
                    <p className="mt-1 text-xs">
                      Origin-specific rates are not supported and no longer apply. Remove these
                      rows to keep the matrix valid before saving.
                    </p>
                  </div>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="shrink-0"
                  onClick={() => setEntries(withoutOriginSpecificEntries(entries))}
                >
                  Remove origin rows
                </Button>
              </div>
            ) : null}
            {districts.length === 0 && cities.length === 0 ? (
              <p className="mb-3 text-xs text-espresso/50">
                Location names are unavailable. Sync courier locations in Delivery settings to
                pick districts and cities by name.
              </p>
            ) : null}
            <RateMatrixTable
              entries={entries}
              onChange={setEntries}
              districts={districts}
              cities={cities}
            />
            <div className="mt-4 flex justify-end">
              <Button
                onClick={onSaveEntries}
                disabled={saveEntries.isPending || originSpecificCount > 0 || hasZoneErrors}
              >
                {saveEntries.isPending ? 'Saving...' : 'Save Zone Overrides'}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
