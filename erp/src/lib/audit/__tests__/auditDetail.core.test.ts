import { describe, expect, it } from 'vitest';

import { auditDetailMode, auditSnapshotRows } from '@/lib/audit/auditDetail.core';

/** ARGUS #454: deletion rows must render a Deleted values section. */
describe('auditDetailMode', () => {
  it('diffs rows with both snapshots', () => {
    expect(auditDetailMode({ amount: 1 }, { amount: 2 })).toBe('diff');
  });

  it('shows created rows from the after snapshot', () => {
    expect(auditDetailMode(null, { name: 'x' })).toBe('created');
    expect(auditDetailMode({}, { name: 'x' })).toBe('created');
  });

  it('shows deleted rows from the before snapshot', () => {
    expect(auditDetailMode({ amount: 1200 }, null)).toBe('deleted');
    expect(auditDetailMode({ amount: 1200 }, {})).toBe('deleted');
  });

  it('reports no detail when both are empty', () => {
    expect(auditDetailMode(null, null)).toBe('none');
    expect(auditDetailMode({}, {})).toBe('none');
  });
});

/** ARGUS #458: a before-only (deletion) snapshot must render real rows. */
describe('auditSnapshotRows', () => {
  it('renders before-only values instead of the no-detail message', () => {
    expect(auditSnapshotRows({ amount: 1200, reason: 'damage' })).toEqual([
      { field: 'amount', value: '1200' },
      { field: 'reason', value: 'damage' },
    ]);
  });

  it('renders object values as JSON and keeps empty snapshots empty', () => {
    expect(auditSnapshotRows({ meta: { a: 1 } })).toEqual([
      { field: 'meta', value: '{"a":1}' },
    ]);
    expect(auditSnapshotRows(null)).toEqual([]);
    expect(auditSnapshotRows({})).toEqual([]);
  });
});
