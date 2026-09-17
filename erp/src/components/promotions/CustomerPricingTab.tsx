'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { AddCustomerPricingRuleDialog } from './AddCustomerPricingRuleDialog';
import { CustomerPricingRow } from './CustomerPricingRow';
import type { CustomerPricingRuleDraft, CustomerPricingRuleRow } from './customerPricing.types';

/**
 * M15-01 (BUG-46) — Customer pricing tab.
 *
 * Thin TanStack Query container over the (already shipped) rules API, using the
 * same fetch/mutate/invalidate style as the promotions table itself:
 *  - `GET  /api/store/customer-pricing-rules?includeInactive=true` for the list
 *    (inactive rows must stay visible — DELETE is a soft deactivate);
 *  - `POST /api/store/customer-pricing-rules` to create (409
 *    CUSTOMER_PRICING_OVERLAP surfaces as the toast message);
 *  - `DELETE /api/store/customer-pricing-rules/{id}` to deactivate.
 *
 * Row and dialog presentation lives in sibling files so this stays a container.
 */

const RULES_QUERY_KEY = ['customer-pricing-rules'] as const;

function toPayload(draft: CustomerPricingRuleDraft) {
  // '' is the schema's own "unset" sentinel for variantId / startsAt / endsAt
  // (it normalizes to undefined → NULL server-side), so blank inputs pass
  // through untouched rather than being dropped client-side.
  return {
    customerTag: draft.customerTag,
    variantId: draft.variantId,
    price: Number(draft.price.trim()),
    startsAt: draft.startsAt,
    endsAt: draft.endsAt,
    isActive: draft.isActive,
  };
}

async function readErrorMessage(res: Response, fallback: string): Promise<string> {
  try {
    const json = await res.json();
    return json?.error?.message ?? fallback;
  } catch {
    return fallback;
  }
}

export function CustomerPricingTab() {
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);

  const { data, isLoading, isError } = useQuery({
    queryKey: RULES_QUERY_KEY,
    queryFn: async () => {
      const res = await fetch('/api/store/customer-pricing-rules?includeInactive=true&limit=100');
      if (!res.ok) throw new Error(await readErrorMessage(res, 'Failed to fetch pricing rules'));
      const json = await res.json();
      return (json.data ?? []) as CustomerPricingRuleRow[];
    },
  });

  const createMutation = useMutation({
    mutationFn: async (draft: CustomerPricingRuleDraft) => {
      const res = await fetch('/api/store/customer-pricing-rules', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(toPayload(draft)),
      });
      if (!res.ok) {
        // 409 CUSTOMER_PRICING_OVERLAP carries an explanatory message — show it.
        throw new Error(await readErrorMessage(res, 'Failed to create pricing rule'));
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: RULES_QUERY_KEY });
      setDialogOpen(false);
      toast.success('Customer pricing rule created');
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const deactivateMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/store/customer-pricing-rules/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error(await readErrorMessage(res, 'Failed to deactivate rule'));
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: RULES_QUERY_KEY });
      toast.success('Pricing rule deactivated');
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const rules = data ?? [];
  const activeCount = rules.filter((rule) => rule.isActive).length;

  return (
    <section className="space-y-4" aria-label="Customer pricing">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-display text-lg text-espresso">Customer Pricing</h2>
          <p className="font-body text-sm text-mist">
            {activeCount} active rule{activeCount === 1 ? '' : 's'} — tagged customers get the
            rule price when it is below the normal selling price.
          </p>
        </div>
        <Button
          className="bg-espresso text-pearl hover:bg-espresso/90 font-body gap-1.5"
          onClick={() => setDialogOpen(true)}
        >
          <Plus className="h-4 w-4" />
          Add rule
        </Button>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-12 w-full" />
          ))}
        </div>
      ) : isError ? (
        <div className="rounded-lg border border-mist/40 bg-linen p-6 text-sm text-mist">
          Customer pricing rules could not be loaded. Reload the page to try again.
        </div>
      ) : rules.length === 0 ? (
        <div className="rounded-lg border border-mist/40 bg-linen p-6 text-center text-sm text-mist">
          No customer pricing rules yet. Add one to give a tagged customer a special price.
        </div>
      ) : (
        <div className="border border-mist/30 rounded-lg overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="bg-linen/50">
                <TableHead className="font-body text-xs text-mist font-medium">Customer tag</TableHead>
                <TableHead className="font-body text-xs text-mist font-medium">Variant</TableHead>
                <TableHead className="font-body text-xs text-mist font-medium">Rule price</TableHead>
                <TableHead className="font-body text-xs text-mist font-medium">Valid window</TableHead>
                <TableHead className="font-body text-xs text-mist font-medium">Status</TableHead>
                <TableHead className="font-body text-xs text-mist font-medium">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rules.map((rule) => (
                <CustomerPricingRow
                  key={rule.id}
                  rule={rule}
                  onDeactivate={(id) => deactivateMutation.mutate(id)}
                  isDeactivating={deactivateMutation.isPending}
                />
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <p className="font-body text-xs text-mist">
        Deactivating a rule stops it applying to carts immediately; the row is kept for audit
        history rather than deleted.
      </p>

      <AddCustomerPricingRuleDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onSubmit={(draft) => createMutation.mutate(draft)}
        isSubmitting={createMutation.isPending}
      />
    </section>
  );
}