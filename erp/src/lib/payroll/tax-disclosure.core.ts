/**
 * PAYE/APIT disclosure (ARGUS #389).
 *
 * The repository contains no Sri Lankan PAYE/APIT bands, reliefs or withholding
 * rules. This module deliberately does not invent any. It provides one shared
 * statement so payroll reports and the UI cannot imply that income tax was
 * withheld when it was not.
 */

export const PAYROLL_TAX_CONFIGURED = false;

export const PAYROLL_TAX_LABEL = 'PAYE/APIT income tax';

export const PAYROLL_TAX_NOT_CONFIGURED_MESSAGE =
  'PAYE/APIT income tax is not configured in this system. Net pay = gross - (no-pay + advances) - employee EPF; no income tax has been withheld or reported.';

export interface PayrollTaxTreatment {
  label: string;
  configured: boolean;
  message: string;
}

export function describePayrollTaxTreatment(): PayrollTaxTreatment {
  return {
    label: PAYROLL_TAX_LABEL,
    configured: PAYROLL_TAX_CONFIGURED,
    message: PAYROLL_TAX_NOT_CONFIGURED_MESSAGE,
  };
}
