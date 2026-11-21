import { describe, expect, it } from 'vitest';

import {
  missingWaybillRecipientFields,
  waybillRecipientPrintDecision,
} from '@/lib/delivery/waybillCompleteness';

const complete = {
  fullName: 'Nimal Perera',
  phone: '077 123 4567',
  addressLine1: '45 Temple Road',
  cityName: 'Kandy',
  districtName: 'Kandy',
  postalCode: '20000',
};

/**
 * ARGUS #300 - an addressless delivery used to print To/Address/Branch/Contact
 * as "-", making the waybill look deliverable.
 */
describe('missingWaybillRecipientFields', () => {
  it('is empty for a complete recipient block', () => {
    expect(missingWaybillRecipientFields(complete)).toEqual([]);
  });

  it('lists every row that would print as a dash for a missing address', () => {
    expect(missingWaybillRecipientFields(null)).toEqual([
      'Recipient name',
      'Contact number',
      'Address',
      'City or district',
    ]);
  });

  it('requires a recipient name, contact, address line and branch', () => {
    expect(missingWaybillRecipientFields({})).toEqual([
      'Recipient name',
      'Contact number',
      'Address',
      'City or district',
    ]);
  });

  it('accepts a district when the city is blank', () => {
    expect(
      missingWaybillRecipientFields({ ...complete, cityName: null }),
    ).toEqual([]);
    expect(
      missingWaybillRecipientFields({ ...complete, cityName: '', districtName: 'Colombo' }),
    ).toEqual([]);
  });

  it('does not require the optional second phone or postal code', () => {
    expect(
      missingWaybillRecipientFields({
        ...complete,
        phone2: null,
        postalCode: null,
      }),
    ).toEqual([]);
  });

  it('treats whitespace-only values as missing', () => {
    expect(
      missingWaybillRecipientFields({
        fullName: '   ',
        phone: ' ',
        addressLine1: '\t',
        cityName: ' ',
      }),
    ).toEqual(['Recipient name', 'Contact number', 'Address', 'City or district']);
  });
});

describe('waybillRecipientPrintDecision', () => {
  it('allows a complete address', () => {
    expect(waybillRecipientPrintDecision(complete)).toEqual({
      canPrint: true,
      missing: [],
      reason: null,
    });
  });

  it('blocks print and names the missing fields', () => {
    const decision = waybillRecipientPrintDecision({
      fullName: 'Nimal Perera',
      phone: null,
      addressLine1: '',
      cityName: 'Kandy',
    });
    expect(decision.canPrint).toBe(false);
    expect(decision.missing).toEqual(['Contact number', 'Address']);
    expect(decision.reason).toBe('Missing recipient details: Contact number, Address');
  });
});
