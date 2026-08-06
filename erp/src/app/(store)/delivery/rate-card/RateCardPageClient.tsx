'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { standardSchemaResolver } from '@hookform/resolvers/standard-schema';
import { useRateCard } from '@/hooks/delivery';
import { usePermissions } from '@/hooks/usePermissions';
import { PERMISSIONS } from '@/lib/constants/permissions';
import {
  UpsertRateCardSchema,
} from '@/lib/validators/ratecard.validators';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { RateMatrixTable } from '@/components/delivery/rate-card/RateMatrixTable';

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

export function RateCardPageClient() {
  const { hasPermission } = usePermissions();
  const canManage = hasPermission(PERMISSIONS.DELIVERY.manageRateCard);
  const { data, isLoading, save, saveEntries } = useRateCard();

  const card = useMemo(() => (data as RateCardData | undefined) ?? null, [data]);
  const initialEntries = card?.entries ?? [];
  const hydrated = useRef(false);

  const [entries, setEntries] = useState<RateEntry[]>(initialEntries);

  // Hydrate the zone matrix once from the loaded rate card.
  useEffect(() => {
    if (hydrated.current) return;
    if (!data) return;
    hydrated.current = true;
    setEntries((card as RateCardData)?.entries ?? []);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data]);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<z.input<typeof UpsertRateCardSchema>, unknown, z.output<typeof UpsertRateCardSchema>>({
    resolver: standardSchemaResolver(UpsertRateCardSchema),
    defaultValues: {
      name: card?.name ?? 'Trans Express Standard',
      baseRate: toNumber(card?.baseRate),
      extraKgRate: toNumber(card?.extraKgRate),
      freeBaseWeightKg: toNumber(card?.freeBaseWeightKg),
      coddCommissionPct: toNumber(card?.coddCommissionPct),
      vatRatePct: toNumber(card?.vatRatePct),
    },
  });

  if (!canManage) {
    return (
      <Card className="border-mist">
        <CardContent className="p-8 text-center text-sm text-espresso/60">
          You do not have permission to manage the delivery rate card.
        </CardContent>
      </Card>
    );
  }

  const onSave = (formData: z.output<typeof UpsertRateCardSchema>) => {
    const body: Record<string, unknown> = { ...formData };
    save.mutate(body);
  };

  const onSaveEntries = () => {
    saveEntries.mutate(entries);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold text-espresso">Delivery Rate Card</h1>
        <p className="text-sm text-espresso/60">
          Base Trans Express pricing and zone-level overrides for COD deliveries.
        </p>
      </div>

      <Card className="border-mist">
        <CardHeader>
          <CardTitle className="font-display text-lg">Base Rate</CardTitle>
          <CardDescription>
            Applied when no zone override matches. All amounts are in Rupees (Rs).
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="grid gap-4 sm:grid-cols-2">
              {Array.from({ length: 6 }).map((_, index) => (
                <Skeleton key={index} className="h-16 w-full" />
              ))}
            </div>
          ) : (
            <form onSubmit={handleSubmit(onSave)} className="space-y-4">
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
                    {...register('baseRate')}
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
                    {...register('extraKgRate')}
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
                    {...register('freeBaseWeightKg')}
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
                    {...register('coddCommissionPct')}
                    placeholder="0.00"
                  />
                  {errors.coddCommissionPct && (
                    <p className="text-sm text-terracotta">{errors.coddCommissionPct.message}</p>
                  )}
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="rate-vat">VAT Rate (%)</Label>
                  <Input
                    id="rate-vat"
                    type="number"
                    step="any"
                    min={0}
                    {...register('vatRatePct')}
                    placeholder="0.00"
                  />
                  {errors.vatRatePct && (
                    <p className="text-sm text-terracotta">{errors.vatRatePct.message}</p>
                  )}
                </div>
              </div>

              <div className="flex justify-end">
                <Button type="submit" disabled={save.isPending}>
                  {save.isPending ? 'Saving...' : 'Save Rate Card'}
                </Button>
              </div>
            </form>
          )}
        </CardContent>
      </Card>

      <Card className="border-mist">
        <CardHeader>
          <CardTitle className="font-display text-lg">Zone Overrides</CardTitle>
          <CardDescription>
            Origin → destination specific rates. Leave a field empty to fall back to the base rate.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <RateMatrixTable entries={entries} onChange={setEntries} />
          <div className="mt-4 flex justify-end">
            <Button onClick={onSaveEntries} disabled={saveEntries.isPending}>
              {saveEntries.isPending ? 'Saving...' : 'Save Zone Overrides'}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
