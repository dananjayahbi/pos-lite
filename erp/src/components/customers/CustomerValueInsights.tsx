'use client';

import { CalendarClock, Tags } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { formatRelativeDate, formatRupee } from '@/lib/format';

export interface PreferredCategory {
  categoryId: string;
  categoryName: string;
  quantity: number;
  lineTotal: string;
}

interface CustomerValueInsightsProps {
  /** ISO date string of the customer's most recent purchase (nullable). */
  lastPurchaseAt?: string | null | undefined;
  /** Ranked list of top preferred categories (top 5). */
  preferredCategories: PreferredCategory[];
}

/**
 * Presentational customer-value section (doc 21): shows recency of last
 * purchase and the customer's top preferred product categories. Receives
 * pre-computed values — no fetching or business logic inside.
 */
export function CustomerValueInsights({
  lastPurchaseAt,
  preferredCategories,
}: CustomerValueInsightsProps) {
  const relative = formatRelativeDate(lastPurchaseAt);

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {/* Recency */}
      <Card>
        <CardHeader className="pb-1">
          <CardTitle className="text-xs font-body text-sand uppercase tracking-wide flex items-center gap-1.5">
            <CalendarClock className="h-3.5 w-3.5" />
            Last Purchase
          </CardTitle>
        </CardHeader>
        <CardContent>
          {relative ? (
            <div>
              <p className="text-xl font-mono font-semibold text-espresso">{relative}</p>
              <p className="text-xs text-sand mt-1">
                {new Date(lastPurchaseAt!).toLocaleDateString('en-LK', {
                  year: 'numeric',
                  month: 'short',
                  day: 'numeric',
                })}
              </p>
            </div>
          ) : (
            <p className="text-sm text-sand">No purchase on record</p>
          )}
        </CardContent>
      </Card>

      {/* Preferred categories */}
      <Card>
        <CardHeader className="pb-1">
          <CardTitle className="text-xs font-body text-sand uppercase tracking-wide flex items-center gap-1.5">
            <Tags className="h-3.5 w-3.5" />
            Preferred Categories
          </CardTitle>
        </CardHeader>
        <CardContent>
          {preferredCategories.length === 0 ? (
            <p className="text-sm text-sand">No purchase data yet</p>
          ) : (
            <ul className="space-y-2">
              {preferredCategories.map((c) => (
                <li key={c.categoryId} className="flex items-center justify-between gap-2">
                  <Badge variant="secondary" className="text-xs">
                    {c.categoryName}
                  </Badge>
                  <span className="text-xs font-mono text-sand">
                    {c.quantity} unit{c.quantity === 1 ? '' : 's'} · {formatRupee(c.lineTotal)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
