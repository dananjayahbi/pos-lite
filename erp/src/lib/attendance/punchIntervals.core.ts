/**
 * Punch interval presentation (ARGUS #356).
 *
 * A day can contain several punches. The table shows the earliest clock-in and
 * latest clock-out, so a 6-minute first-to-last span can look like 6 minutes of
 * work while Worked correctly says 4. The detail dialog and this helper show
 * every interval and the gaps between them so the two numbers reconcile.
 */

export interface PunchIntervalInput {
  id: string;
  clockedInAt: string;
  clockedOutAt: string | null;
  /** Server-computed duration; open punches are already capped. */
  durationMinutes: number;
}

export interface PunchInterval {
  id: string;
  startAt: string;
  endAt: string;
  minutes: number;
  isOpen: boolean;
}

export interface PunchIntervalSummary {
  count: number;
  intervals: PunchInterval[];
  /** Sum of each punch's own duration. */
  workedMinutes: number;
  /** Earliest clock-in to latest clock-out. */
  spanMinutes: number;
  /** Time between punches: span - worked (never negative). */
  gapMinutes: number;
  hasMultiple: boolean;
}

function endOf(record: PunchIntervalInput): Date {
  if (record.clockedOutAt) return new Date(record.clockedOutAt);
  // Open punch: the server caps duration at now/max-shift, so derive the
  // displayed end from that safe duration.
  return new Date(
    new Date(record.clockedInAt).getTime() + Math.max(0, record.durationMinutes) * 60_000,
  );
}

export function summarizePunchIntervals(
  records: readonly PunchIntervalInput[],
): PunchIntervalSummary {
  const intervals: PunchInterval[] = records.flatMap((record) => {
    const start = new Date(record.clockedInAt);
    const end = endOf(record);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return [];

    const minutes = Math.max(
      0,
      Math.round(
        record.durationMinutes > 0
          ? record.durationMinutes
          : (end.getTime() - start.getTime()) / 60_000,
      ),
    );
    return [
      {
        id: record.id,
        startAt: start.toISOString(),
        endAt: end.toISOString(),
        minutes,
        isOpen: record.clockedOutAt === null,
      },
    ];
  });

  const workedMinutes = intervals.reduce((sum, interval) => sum + interval.minutes, 0);
  let spanMinutes = 0;
  if (intervals.length > 0) {
    const earliest = Math.min(...intervals.map((interval) => new Date(interval.startAt).getTime()));
    const latest = Math.max(...intervals.map((interval) => new Date(interval.endAt).getTime()));
    spanMinutes = Math.max(0, Math.round((latest - earliest) / 60_000));
  }

  return {
    count: intervals.length,
    intervals,
    workedMinutes,
    spanMinutes,
    gapMinutes: Math.max(0, spanMinutes - workedMinutes),
    hasMultiple: intervals.length > 1,
  };
}
