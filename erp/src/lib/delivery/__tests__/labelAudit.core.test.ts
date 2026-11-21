import { describe, expect, it } from 'vitest';

import { labelSenderChanges, toLabelSenderSnapshot } from '@/lib/delivery/labelAudit.core';

describe('toLabelSenderSnapshot', () => {
  it('reads the sender values from an audit row', () => {
    expect(
      toLabelSenderSnapshot({
        brandName: ' Dilani ',
        fromContact: '076 199 2828',
        pickupAddress: '12 Temple Road',
      }),
    ).toEqual({
      brandName: 'Dilani',
      fromContact: '076 199 2828',
      pickupAddress: '12 Temple Road',
    });
  });

  it('returns null for a reset row with no snapshot', () => {
    expect(toLabelSenderSnapshot(null)).toBeNull();
    expect(toLabelSenderSnapshot('text')).toBeNull();
    expect(toLabelSenderSnapshot([])).toBeNull();
  });
});

describe('labelSenderChanges (ARGUS #306)', () => {
  it('lists only the fields that changed', () => {
    expect(
      labelSenderChanges(
        { brandName: 'Old Store', fromContact: '011 111 1111', pickupAddress: 'Old Road' },
        { brandName: 'New Store', fromContact: '011 111 1111', pickupAddress: 'Old Road' },
      ),
    ).toEqual([{ field: 'Sender name', from: 'Old Store', to: 'New Store' }]);
  });

  it('shows an added and a cleared value', () => {
    expect(
      labelSenderChanges(
        { brandName: 'Store', fromContact: '', pickupAddress: 'Old Road' },
        { brandName: 'Store', fromContact: '077 222 2222', pickupAddress: '' },
      ),
    ).toEqual([
      { field: 'Sender contact', from: '', to: '077 222 2222' },
      { field: 'Pickup address', from: 'Old Road', to: '' },
    ]);
  });

  it('returns nothing when a save changed no sender value', () => {
    expect(labelSenderChanges({ brandName: 'Store' }, { brandName: 'Store' })).toEqual([]);
  });
});
