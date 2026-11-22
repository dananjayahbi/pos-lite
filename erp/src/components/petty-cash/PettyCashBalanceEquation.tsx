'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { formatRupee } from '@/lib/format';
import { resolveLowBalanceDisplay } from '@/lib/petty-cash/low-balance';

interface BalanceEquationProps {
  openingBalance: number;
  totalTopUps: number;
  totalExpenses: number;
  currentBalance: number;
  /** Configured alert threshold; a positive balance at/below it is low. */
  lowBalanceThreshold?: number | string | null;
  currency?: string;
}

/**
 * Renders the petty-cash balance equation explicitly (doc 39 Step 3):
 *   Opening + Cash In (Top-ups) − Expenses = Balance
 * Each component is labelled so the owner can trace the arithmetic, including
 * the cash added through the Add Cash In button.
 */
export function PettyCashBalanceEquation({
  openingBalance,
  totalTopUps,
  totalExpenses,
  currentBalance,
  lowBalanceThreshold,
  currency,
}: BalanceEquationProps) {
  // ARGUS #414: highlight a positive balance at/below the threshold, not only a
  // negative one, and label the state explicitly.
  const low = resolveLowBalanceDisplay(currentBalance, lowBalanceThreshold);
  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="text-sm font-normal text-sand-ink">Balance Equation</CardTitle>
          {low.label && (
            <Badge className="bg-terracotta text-pearl" aria-label={low.label}>
              {low.label}
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="space-y-1">
            <p className="text-xs text-sand-ink">Opening</p>
            <p className="font-mono text-lg font-semibold text-espresso">
              {formatRupee(openingBalance)}
            </p>
          </div>
          <span className="font-display text-xl text-sand-ink">+</span>
          <div className="space-y-1">
            <p className="text-xs text-sand-ink">Cash In</p>
            <p className="font-mono text-lg font-semibold text-green-700">
              {formatRupee(totalTopUps)}
            </p>
          </div>
          <span className="font-display text-xl text-sand-ink">−</span>
          <div className="space-y-1">
            <p className="text-xs text-sand-ink">Expenses</p>
            <p className="font-mono text-lg font-semibold text-terracotta">
              {formatRupee(totalExpenses)}
            </p>
          </div>
          <span className="font-display text-xl text-sand-ink">=</span>
          <div className="space-y-1">
            <p className="text-xs text-sand-ink">Balance</p>
            <p
              className={`font-mono text-lg font-semibold ${
                low.isLow ? 'text-terracotta' : 'text-espresso'
              }`}
            >
              {formatRupee(currentBalance)}
            </p>
          </div>
        </div>
        {currency && <p className="mt-2 text-xs text-sand-ink">{currency}</p>}
      </CardContent>
    </Card>
  );
}
