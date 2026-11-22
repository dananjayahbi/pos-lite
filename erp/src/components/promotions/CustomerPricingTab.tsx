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
import {
  getPromotionLiveState,
  isPromotionLive,
} from '@/lib/services/promotionLiveState.core';

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
/** ARGUS #333: the API caps a page at 100; the tab shows 50 and paginates. */
const RULES_PAGE_SIZE = 50;

interface RulesPageMeta {
  page: number;
  limit: number;
  total: number;
  hasMore: boolean;
}

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

export function CustomerPricingTab({ canCreate, canEdit }: { canCreate: boolean; canEdit: boolean }) {
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingRule, setEditingRule] = useState<CustomerPricingRuleRow | null>(null);
  const [page, setPage] = useState(1);

  const { data, isLoading, isError, error, refetch, isFetching } = useQuery({
    queryKey: [...RULES_QUERY_KEY, page],
    queryFn: async () => {
      const res = await fetch(
        `/api/store/customer-pricing-rules?includeInactive=true&page=${page}&limit=${RULES_PAGE_SIZE}`,
      );
      if (!res.ok) throw new Error(await readErrorMessage(res, 'Failed to fetch pricing rules'));
      const json = await res.json();
      return {
        rules: (json.data ?? []) as CustomerPricingRuleRow[],
        meta: (json.meta ?? null) as RulesPageMeta | null,
      };
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
      setEditingRule(null);
      toast.success('Customer pricing rule created');
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, draft }: { id: string; draft: CustomerPricingRuleDraft }) => {
      const res = await fetch(`/api/store/customer-pricing-rules/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(toPayload(draft)),
      });
      if (!res.ok) {
        throw new Error(await readErrorMessage(res, 'Failed to update pricing rule'));
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: RULES_QUERY_KEY });
      setDialogOpen(false);
      setEditingRule(null);
      toast.success('Customer pricing rule updated');
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

  const rules = data?.rules ?? [];
  const meta = data?.meta ?? null;
  const totalPages = meta ? Math.max(1, Math.ceil(meta.total / RULES_PAGE_SIZE)) : 1;
  // ARGUS #329: only rules that are on AND inside their window apply now.
  // ARGUS #333: the list is paginated, so this is the live count on this page.
  const activeCount = rules.filter((rule) =>
    isPromotionLive(getPromotionLiveState(rule)),
  ).length;

  return (
    <section className="space-y-4" aria-label="Customer pricing">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-display text-lg text-espresso">Customer Pricing</h2>
          <p className="font-body text-sm text-mist-ink">
            {activeCount} rule{activeCount === 1 ? '' : 's'} active now on this page - tagged
            customers get the rule price when it is below the normal selling price.
          </p>
        </div>
        {canCreate && (
          <Button
            className="bg-espresso text-pearl hover:bg-espresso/90 font-body gap-1.5"
            onClick={() => {
              setEditingRule(null);
              setDialogOpen(true);
            }}
          >
            <Plus className="h-4 w-4" />
            Add rule
          </Button>
        )}
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-12 w-full" />
          ))}
        </div>
      ) : isError ? (
        <div className="rounded-lg border border-[#9B2226]/30 bg-[#9B2226]/5 p-6">
          <p className="text-sm text-[#9B2226]">
            Customer pricing rules could not be loaded.{' '}
            {error instanceof Error ? error.message : 'Try again.'}
          </p>
          <Button
            variant="outline"
            className="mt-3 font-body"
            onClick={() => refetch()}
            disabled={isFetching}
          >
            {isFetching ? 'Retrying...' : 'Retry'}
          </Button>
        </div>
      ) : rules.length === 0 ? (
        <div className="rounded-lg border border-mist/40 bg-linen p-6 text-center text-sm text-mist-ink">
          No customer pricing rules yet. Add one to give a tagged customer a special price.
        </div>
      ) : (
        <div className="border border-mist/30 rounded-lg overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="bg-linen/50">
                <TableHead className="font-body text-xs text-mist-ink font-medium">Customer tag</TableHead>
                <TableHead className="font-body text-xs text-mist-ink font-medium">Variant</TableHead>
                <TableHead className="font-body text-xs text-mist-ink font-medium">Rule price</TableHead>
                <TableHead className="font-body text-xs text-mist-ink font-medium">Valid window</TableHead>
                <TableHead className="font-body text-xs text-mist-ink font-medium">Status</TableHead>
                <TableHead className="font-body text-xs text-mist-ink font-medium">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rules.map((rule) => (
                <CustomerPricingRow
                  key={rule.id}
                  rule={rule}
                  canEdit={canEdit}
                  onEdit={(editTarget) => {
                    setEditingRule(editTarget);
                    setDialogOpen(true);
                  }}
                  onDeactivate={(id) => deactivateMutation.mutate(id)}
                  isDeactivating={deactivateMutation.isPending}
                />
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {meta && meta.total > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="font-body text-xs text-mist-ink">
            Showing {(meta.page - 1) * RULES_PAGE_SIZE + 1}-
            {Math.min(meta.page * RULES_PAGE_SIZE, meta.total)} of {meta.total} rule
            {meta.total === 1 ? '' : 's'} ({RULES_PAGE_SIZE} per page).
          </p>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              className="font-body"
              disabled={page <= 1 || isFetching}
              onClick={() => setPage((current) => Math.max(1, current - 1))}
            >
              Previous
            </Button>
            <span className="font-body text-xs text-mist-ink">
              Page {meta.page} of {totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              className="font-body"
              disabled={!meta.hasMore || isFetching}
              onClick={() => setPage((current) => current + 1)}
            >
              Next
            </Button>
          </div>
        </div>
      )}

      <p className="font-body text-xs text-mist-ink">
        Deactivating a rule stops it applying to carts immediately; the row is kept for audit
        history rather than deleted. Rules are listed {RULES_PAGE_SIZE} per page so tenants with
        more than 100 rules can still reach every row.
      </p>

      <AddCustomerPricingRuleDialog
        open={dialogOpen}
        onOpenChange={(open) => {
          setDialogOpen(open);
          if (!open) setEditingRule(null);
        }}
        rule={editingRule}
        onSubmit={(draft) => {
          if (editingRule) {
            updateMutation.mutate({ id: editingRule.id, draft });
          } else {
            createMutation.mutate(draft);
          }
        }}
        isSubmitting={createMutation.isPending || updateMutation.isPending}
      />
    </section>
  );
}