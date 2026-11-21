import { describe, expect, it } from 'vitest';
import {
  assessAttendanceCompleteness,
  summarizeAttendanceCompleteness,
  type AttendanceCompleteness,
} from '@/lib/payroll/attendance-completeness.core';

function completeness(
  patch: Partial<AttendanceCompleteness> = {},
): AttendanceCompleteness {
  return {
    status: 'COMPLETE',
    expectedWorkingDays: 22,
    recordedDays: 22,
    missingDays: 0,
    label: 'Attendance complete',
    ...patch,
  };
}

describe('assessAttendanceCompleteness', () => {
  it('reports a fully recorded month', () => {
    const result = assessAttendanceCompleteness({
      expectedWorkingDays: 22,
      recordedDays: 22,
    });
    expect(result.status).toBe('COMPLETE');
    expect(result.missingDays).toBe(0);
  });

  it('reports a month with no attendance rows at all', () => {
    const result = assessAttendanceCompleteness({
      expectedWorkingDays: 22,
      recordedDays: 0,
    });
    expect(result.status).toBe('NO_DATA');
    expect(result.missingDays).toBe(22);
    expect(result.label).toContain('No attendance recorded for 22');
  });

  it('reports partially recorded attendance', () => {
    const result = assessAttendanceCompleteness({
      expectedWorkingDays: 22,
      recordedDays: 9,
    });
    expect(result.status).toBe('PARTIAL');
    expect(result.missingDays).toBe(13);
    expect(result.label).toContain('13 of 22');
  });

  it('reports a period with no scheduled working days', () => {
    const result = assessAttendanceCompleteness({
      expectedWorkingDays: 0,
      recordedDays: 0,
    });
    expect(result.status).toBe('NOT_SCHEDULED');
    expect(result.missingDays).toBe(0);
  });

  it('clamps malformed counts instead of producing negative gaps', () => {
    const result = assessAttendanceCompleteness({
      expectedWorkingDays: Number.NaN,
      recordedDays: 5,
    });
    expect(result.expectedWorkingDays).toBe(0);
    expect(result.recordedDays).toBe(0);
    expect(result.missingDays).toBe(0);

    const overRecorded = assessAttendanceCompleteness({
      expectedWorkingDays: 10,
      recordedDays: 40,
    });
    expect(overRecorded.recordedDays).toBe(10);
    expect(overRecorded.missingDays).toBe(0);
  });
});

describe('summarizeAttendanceCompleteness', () => {
  it('stays quiet for complete and partially recorded months', () => {
    const summary = summarizeAttendanceCompleteness([
      {
        userId: 'u1',
        staffName: 'Amara',
        netSalary: '44000.00',
        completeness: completeness(),
      },
      {
        userId: 'u2',
        staffName: 'Bimal',
        netSalary: '30000.00',
        completeness: completeness({
          status: 'PARTIAL',
          recordedDays: 18,
          missingDays: 4,
          label: '4 of 22 working days have no attendance record',
        }),
      },
    ]);

    expect(summary.staffWithNoData).toEqual([]);
    expect(summary.staffWithPartial).toEqual([{ userId: 'u2', staffName: 'Bimal' }]);
    expect(summary.missingDays).toBe(4);
    expect(summary.requiresConfirmation).toBe(false);
    expect(summary.message).toContain('Attendance is incomplete for 1 employee');
  });

  it('requires confirmation when the whole month has no attendance', () => {
    const summary = summarizeAttendanceCompleteness([
      {
        userId: 'u1',
        staffName: 'Amara',
        netSalary: '44000.00',
        completeness: completeness({
          status: 'NO_DATA',
          recordedDays: 0,
          missingDays: 22,
        }),
      },
      {
        userId: 'u2',
        staffName: 'Bimal',
        netSalary: '30000.00',
        completeness: completeness({
          status: 'NO_DATA',
          recordedDays: 0,
          missingDays: 22,
        }),
      },
    ]);

    expect(summary.staffWithNoData).toHaveLength(2);
    expect(summary.missingDays).toBe(44);
    expect(summary.requiresConfirmation).toBe(true);
    expect(summary.message).toContain('No attendance is recorded for 2 employees');
    expect(summary.message).toContain('treated as absent');
  });

  it('requires confirmation for staff with no scheduled days but a paid row', () => {
    const summary = summarizeAttendanceCompleteness([
      {
        userId: 'u1',
        staffName: 'Chamari',
        netSalary: '52000.00',
        completeness: completeness({
          status: 'NOT_SCHEDULED',
          expectedWorkingDays: 0,
          recordedDays: 0,
        }),
      },
    ]);

    expect(summary.staffNotScheduled).toHaveLength(1);
    expect(summary.requiresConfirmation).toBe(true);
    expect(summary.message).toContain('their salary is paid in full');
  });

  it('returns no message for an empty or fully complete run', () => {
    expect(summarizeAttendanceCompleteness([]).message).toBeNull();
    expect(
      summarizeAttendanceCompleteness([
        {
          userId: 'u1',
          staffName: 'Amara',
          netSalary: '44000.00',
          completeness: completeness(),
        },
      ]).message,
    ).toBeNull();
  });
});
