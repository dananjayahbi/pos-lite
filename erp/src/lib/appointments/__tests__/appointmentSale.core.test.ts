import { describe, expect, it } from 'vitest';
import Decimal from 'decimal.js';

import { computeAppointmentSalePricing } from '@/lib/appointments/appointmentSale.core';

/**
 * ARGUS #119: the conversion used to write a bare CASH sale at the service
 * price with no tax, no line and no payment, ignoring the deposit. The pricing
 * helper now mirrors a normal sale and splits the deposit from the balance.
 */
describe('computeAppointmentSalePricing', () => {
  it('adds tenant VAT to the service price', () => {
    const pricing = computeAppointmentSalePricing({ price: 2500, vatRate: 18 });

    expect(pricing.subtotal.toNumber()).toBe(2500);
    expect(pricing.taxAmount.toNumber()).toBe(450);
    expect(pricing.totalAmount.toNumber()).toBe(2950);
    expect(pricing.depositApplied.toNumber()).toBe(0);
    expect(pricing.balanceDue.toNumber()).toBe(2950);
  });

  it('treats the deposit as already collected and leaves the balance due', () => {
    const pricing = computeAppointmentSalePricing({ price: 2500, vatRate: 18, deposit: 500 });

    expect(pricing.depositApplied.toNumber()).toBe(500);
    expect(pricing.balanceDue.toNumber()).toBe(2450);
  });

  it('caps a deposit larger than the total', () => {
    const pricing = computeAppointmentSalePricing({ price: 1000, vatRate: 18, deposit: 5000 });

    expect(pricing.totalAmount.toNumber()).toBe(1180);
    expect(pricing.depositApplied.toNumber()).toBe(1180);
    expect(pricing.balanceDue.toNumber()).toBe(0);
  });

  it('charges no tax when the tenant has no VAT rate', () => {
    const pricing = computeAppointmentSalePricing({ price: 2500, vatRate: 0 });

    expect(pricing.taxAmount.toNumber()).toBe(0);
    expect(pricing.totalAmount.toNumber()).toBe(2500);
  });

  it('rounds cents consistently', () => {
    const pricing = computeAppointmentSalePricing({ price: '1999.99', vatRate: 18 });

    expect(pricing.taxAmount.toNumber()).toBe(360);
    expect(pricing.totalAmount.toNumber()).toBe(2359.99);
    expect(pricing.totalAmount.minus(pricing.subtotal).minus(pricing.taxAmount).toNumber()).toBe(0);
  });

  it('accepts Decimal inputs', () => {
    const pricing = computeAppointmentSalePricing({
      price: new Decimal('2500.00'),
      vatRate: 18,
      deposit: new Decimal('300.50'),
    });

    expect(pricing.balanceDue.toNumber()).toBe(2649.5);
  });

  it('applies the service tax rule (ARGUS #131)', () => {
    expect(
      computeAppointmentSalePricing({ price: 1000, vatRate: 18, taxRule: 'STANDARD_VAT' })
        .taxAmount.toNumber(),
    ).toBe(180);
    expect(
      computeAppointmentSalePricing({
        price: 1000,
        vatRate: 18,
        ssclRate: 2.5,
        taxRule: 'SSCL',
      }).taxAmount.toNumber(),
    ).toBe(25);
    expect(
      computeAppointmentSalePricing({ price: 1000, vatRate: 18, taxRule: 'EXEMPT' })
        .taxAmount.toNumber(),
    ).toBe(0);
  });
});
