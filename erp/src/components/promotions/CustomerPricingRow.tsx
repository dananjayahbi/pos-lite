'use client';

import { formatRupee } from '@/lib/format';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { TableCell, TableRow } from '@/components/ui/table';
import type { CustomerPricingRuleRow } from './customerPricing.types';

/**
 * M15-01 (BUG-46) — one customer pricing rule row.
 *
 * Split out of `CustomerPricingTab` so the tab stays a thin fetch/mutate
 * container (mirrors the promotions page's modular table/dialog split). Two
 * notes the UI must surface honestly:
 *  - an empty variant means "all variants" (the API stores NULL);
 *  - the Deactivate button hits `DELETE`, which is a SOFT deactivate
 *    (isActive:false) — the rule stays auditable and never hard-deletes.
 */

function formatWindow(startsAt: string | null, endsAt: string | null): string {
  const fmt = (value: string) =>
    new Date(value).toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  if (!startsAt && !endsAt) return 'Always';
  if (startsAt && endsAt) return `${fmt(startsAt)} – ${fmt(endsAt)}`;
  if (startsAt) return `From ${fmt(startsAt)}`;
  return `Until ${fmt(endsAt as string)}`;
}

interface CustomerPricingRowProps {
  rule: CustomerPricingRuleRow;
  onDeactivate: (id: string) => void;
  isDeactivating: boolean;
}

export function CustomerPricingRow({ rule, onDeactivate, isDeactivating }: CustomerPricingRowProps) {
  const variantLabel = rule.variant
    ? `${rule.variant.product.name} — ${rule.variant.sku}`
    : 'All variants';

  return (
    <TableRow className="hover:bg-linen/30">
      <TableCell>
        <Badge variant="secondary" className="font-body text-xs bg-sand text-espresso">
          {rule.customerTag}
        </Badge>
      </TableCell>
      <TableCell className="font-body text-sm text-espresso">
        {rule.variant ? (
          <>
            <p className="font-medium">{rule.variant.product.name}</p>
            <p className="text-xs text-mist font-mono">{rule.variant.sku}</p>
          </>
        ) : (
          <span className="text-mist">All variants</span>
        )}
      </TableCell>
      <TableCell className="font-mono text-sm text-espresso">
        <p>{formatRupee(rule.price)}</p>
        {rule.variant ? (
          <p className="text-xs text-mist line-through">{formatRupee(rule.variant.retailPrice)}</p>
        ) : null}
      </TableCell>
      <TableCell className="font-body text-xs text-mist">
        {formatWindow(rule.startsAt, rule.endsAt)}
      </TableCell>
      <TableCell>
        <Badge
          variant="secondary"
          className={`font-body text-xs ${rule.isActive ? 'bg-green-50 text-green-700' : 'bg-mist/20 text-mist'}`}
        >
          {rule.isActive ? 'Active' : 'Inactive'}
        </Badge>
      </TableCell>
      <TableCell>
        <Button
          variant="ghost"
          size="sm"
          className="text-terracotta hover:text-espresso"
          disabled={!rule.isActive || isDeactivating}
          onClick={() => onDeactivate(rule.id)}
          aria-label={`Deactivate pricing rule for ${rule.customerTag} on ${variantLabel}`}
        >
          Deactivate
        </Button>
      </TableCell>
    </TableRow>
  );
}