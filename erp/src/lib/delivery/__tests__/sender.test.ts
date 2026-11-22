import { describe, expect, it } from 'vitest';

import {
  resolveWaybillSender,
  waybillSenderDecision,
} from '@/lib/delivery/sender';

/**
 * ARGUS #301 - the saved label sender ("Ayur Wellness Centre") must not override
 * the audited Store Profile business ("Ruhunu Weda Gedara").
 */
describe('resolveWaybillSender', () => {
  it('uses the business name, contact and pickup address', () => {
    expect(
      resolveWaybillSender({
        name: '  Ruhunu Weda Gedara ',
        contact: ' 0713617236 ',
        pickupAddress: ' 12 Temple Road, Matara ',
      }),
    ).toEqual({
      name: 'Ruhunu Weda Gedara',
      contact: '0713617236',
      pickupAddress: '12 Temple Road, Matara',
      missing: [],
    });
  });

  it('does not invent values when the profile is empty', () => {
    expect(resolveWaybillSender({})).toEqual({
      name: '',
      contact: '',
      pickupAddress: '',
      missing: ['Sender name', 'Sender contact', 'Pickup address'],
    });
  });

  it('surfaces a missing pickup address separately', () => {
    expect(
      resolveWaybillSender({
        name: 'Ruhunu Weda Gedara',
        contact: '0713617236',
      }),
    ).toEqual({
      name: 'Ruhunu Weda Gedara',
      contact: '0713617236',
      pickupAddress: '',
      missing: ['Pickup address'],
    });
  });
});

describe('waybillSenderDecision', () => {
  it('allows print when name and contact are configured', () => {
    expect(
      waybillSenderDecision({
        name: 'Ruhunu Weda Gedara',
        contact: '0713617236',
        pickupAddress: 'Matara',
      }),
    ).toEqual({ canPrint: true, missing: [], reason: null });
  });

  it('blocks print when the sender name or contact is missing', () => {
    const decision = waybillSenderDecision({ pickupAddress: 'Matara' });
    expect(decision.canPrint).toBe(false);
    expect(decision.missing).toEqual(['Sender name', 'Sender contact']);
    expect(decision.reason).toBe('Missing sender details: Sender name, Sender contact');
  });

  it('allows print but warns when only the pickup address is missing', () => {
    const decision = waybillSenderDecision({
      name: 'Ruhunu Weda Gedara',
      contact: '0713617236',
    });
    expect(decision.canPrint).toBe(true);
    expect(decision.missing).toEqual(['Pickup address']);
    expect(decision.reason).toBe('Missing sender details: Pickup address');
  });

  it('accepts a resolved label template shape', () => {
    expect(
      waybillSenderDecision({
        brandName: 'Ruhunu Weda Gedara',
        fromContact: '0713617236',
        pickupAddress: 'Matara',
      }).canPrint,
    ).toBe(true);
  });
});
