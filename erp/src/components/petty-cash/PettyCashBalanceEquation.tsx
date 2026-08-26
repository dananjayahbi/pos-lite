'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { formatRupee } from '@/lib/format';

interface BalanceEquationProps {
  openingBalance: number;
  totalExpenses: number;
  currentBalance: number;
  currency?: string;
}

/**
 * Renders the petty-cash balance equation explicitly (doc 39 Step 3):
 *   Opening: Rs. X − Expenses: Rs. Y = Balance: Rs. Z
 * Each component is labelled so the owner can trace the arithmetic.
 */
export function PettyCashBalanceEquation({
  openingBalance,
  totalExpenses,
  currentBalance,
  currency,
}: BalanceEquationProps) {
  const isLow = currentBalance < 0;
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-normal text-sand">Balance Equation</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="space-y-1">
            <p className="text-xs text-sand">Opening</p>
            <p className="font-mono text-lg font-semibold text-espresso">
              {formatRupee(openingBalance)}
            </p>
          </div>
          <span className="font-display text-xl text-sand">−</span>
          <div className="space-y-1">
            <p className="text-xs text-sand">Expenses</p>
            <p className="font-mono text-lg font-semibold text-terracotta">
              {formatRupee(totalExpenses)}
            </p>
          </div>
          <span className="font-display text-xl text-sand">=</span>
          <div className="space-y-1">
            <p className="text-xs text-sand">Balance</p>
            <p
              className={`font-mono text-lg font-semibold ${
                isLow ? 'text-terracotta' : 'text-espresso'
              }`}
            >
              {formatRupee(currentBalance)}
            </p>
          </div>
        </div>
        {currency && <p className="mt-2 text-xs text-sand">{currency}</p>}
      </CardContent>
    </Card>
  );
}
