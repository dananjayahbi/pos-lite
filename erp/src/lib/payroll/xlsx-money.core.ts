import * as XLSX from 'xlsx';

/**
 * Money cells in payroll exports (ARGUS #390).
 *
 * `aoa_to_sheet` writes numbers in General format, so Rs 26,000.00 showed as
 * `26000` and Rs 28,380.80 as `28380.8`. Two-decimal accounting formatting is
 * applied explicitly here so Excel matches the page and the PDF.
 */
export const PAYROLL_MONEY_FORMAT = '#,##0.00';

export function applyMoneyNumberFormat(
  sheet: XLSX.WorkSheet,
  columns: readonly number[],
  fromRow: number,
  toRow: number,
): void {
  for (let row = Math.max(0, fromRow); row <= toRow; row += 1) {
    for (const column of columns) {
      const ref = XLSX.utils.encode_cell({ r: row, c: column });
      const cell = sheet[ref];
      if (cell && typeof cell.v === 'number') {
        cell.z = PAYROLL_MONEY_FORMAT;
      }
    }
  }
}
