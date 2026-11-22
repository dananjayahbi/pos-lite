import { describe, expect, it } from 'vitest';

import {
  filterStaffRoster,
  paginateStaffRoster,
  rosterDisplayName,
} from '@/lib/services/staffRosterFilter.core';

/** ARGUS #465: roster identity, search and paging. */
const roster = [
  { email: 'owner@ayurpos.dev', fullName: 'Dilani Perera', role: 'OWNER', isActive: true },
  { email: 'cashier1@ayurpos.dev', fullName: null, role: 'CASHIER', isActive: true },
  { email: 'cashier1@other.lk', fullName: null, role: 'CASHIER', isActive: false },
  { email: 'stock@ayurpos.dev', fullName: 'Nimal Silva', role: 'STOCK_CLERK', isActive: true },
];

describe('rosterDisplayName', () => {
  it('prefers the stored full name', () => {
    expect(rosterDisplayName(roster[0]!)).toBe('Dilani Perera');
  });

  it('falls back to a readable mailbox alias', () => {
    expect(rosterDisplayName(roster[1]!)).toBe('cashier1');
  });
});

describe('filterStaffRoster', () => {
  it('matches the full email, not only the local part', () => {
    const hits = filterStaffRoster(roster, { search: 'cashier1@other.lk' });
    expect(hits.map((row) => row.email)).toEqual(['cashier1@other.lk']);
  });

  it('is case-insensitive and searches names too', () => {
    expect(filterStaffRoster(roster, { search: 'NIMAL' })).toHaveLength(1);
    expect(filterStaffRoster(roster, { search: 'owner@ayurpos' })).toHaveLength(1);
  });

  it('filters by role and status', () => {
    expect(filterStaffRoster(roster, { role: 'CASHIER' })).toHaveLength(2);
    expect(filterStaffRoster(roster, { status: 'ACTIVE' })).toHaveLength(3);
    expect(filterStaffRoster(roster, { status: 'INACTIVE' })).toHaveLength(1);
    expect(
      filterStaffRoster(roster, { role: 'CASHIER', status: 'ACTIVE' }),
    ).toHaveLength(1);
  });

  it('treats ALL and blank input as no filter', () => {
    expect(filterStaffRoster(roster, { role: 'ALL', status: 'ALL', search: '' })).toHaveLength(
      roster.length,
    );
  });
});

describe('paginateStaffRoster', () => {
  it('slices pages and clamps an out-of-range page', () => {
    const first = paginateStaffRoster(roster, 1, 2);
    expect(first.rows).toHaveLength(2);
    expect(first.pageCount).toBe(2);
    expect(first.total).toBe(4);

    const beyond = paginateStaffRoster(roster, 9, 2);
    expect(beyond.page).toBe(2);
    expect(beyond.rows.map((row) => row.email)).toEqual([
      'cashier1@other.lk',
      'stock@ayurpos.dev',
    ]);
  });

  it('always returns one page for an empty roster', () => {
    const empty = paginateStaffRoster([], 3, 10);
    expect(empty).toMatchObject({ page: 1, pageCount: 1, total: 0 });
    expect(empty.rows).toEqual([]);
  });
});
