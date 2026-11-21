/**
 * Usage copy for the Units table (ARGUS #483).
 *
 * `usageCount` only counted live raw materials, so a unit that showed
 * "1 material" could actually be referenced by five rows (one live plus four
 * archived). Archived references are disclosed next to the live count instead
 * of being silently dropped.
 */
export function formatUnitUsage(live: number, archived = 0): string {
  const liveLabel = `${live} material${live === 1 ? '' : 's'}`;
  if (archived <= 0) return liveLabel;
  return `${liveLabel} (${archived} archived)`;
}
