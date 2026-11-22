import Decimal from 'decimal.js';

/**
 * ARGUS #373 — payroll ledger posting plan.
 *
 * Single documented rule (no double counting):
 *   total company cost = gross + employer EPF + employer ETF
 * is split into one SALARIES leg and one STAFF_COMMISSIONS leg per payroll
 * commission payout. The salary leg is `companyCost - sum(commission legs)`,
 * so the expenses always sum to the payroll's total company cost exactly.
 * Employee EPF is already withheld inside gross salary and is not a second
 * expense; employer EPF/ETF are included in the salary leg.
 *
 * Payroll generation writes nothing to the ledger; this plan runs only when
 * the run is marked PAID.
 */
export interface PayrollPostingLeg {
  category: 'SALARIES' | 'STAFF_COMMISSIONS';
  amount: string;
  description: string;
  /** Present for a commission leg: the reserved payout it settles. */
  payoutId?: string;
}

export interface PayrollPostingPlan {
  legs: PayrollPostingLeg[];
  total: string;
}

function money(value: Decimal.Value): Decimal {
  return new Decimal(value).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
}

export function buildPayrollPostingPlan(input: {
  periodMonth: string;
  runId: string;
  totalCompanyCost: Decimal.Value;
  commissionPayouts: ReadonlyArray<{ id: string; userId: string; amount: Decimal.Value }>;
}): PayrollPostingPlan {
  const payoutLegs: PayrollPostingLeg[] = [];
  let commissionTotal = new Decimal(0);

  for (const payout of input.commissionPayouts) {
    const amount = money(payout.amount);
    if (amount.lessThanOrEqualTo(0)) continue;
    commissionTotal = commissionTotal.plus(amount);
    payoutLegs.push({
      category: 'STAFF_COMMISSIONS',
      amount: amount.toFixed(2),
      description: `Staff commissions - payroll ${input.periodMonth} (${input.runId})`,
      payoutId: payout.id,
    });
  }

  const companyCost = money(input.totalCompanyCost);
  const salaryAmount = money(companyCost.minus(commissionTotal));
  const salaryLeg: PayrollPostingLeg | null = salaryAmount.greaterThan(0)
    ? {
        category: 'SALARIES',
        amount: salaryAmount.toFixed(2),
        description: `Salaries & statutory contributions - payroll ${input.periodMonth} (${input.runId})`,
      }
    : null;

  const legs = [...(salaryLeg ? [salaryLeg] : []), ...payoutLegs];
  const total = legs.reduce((sum, leg) => sum.plus(leg.amount), new Decimal(0));

  return { legs, total: money(total).toFixed(2) };
}
