'use client';

import React from 'react';
import type { PublicTrackingOrder } from '@/types/website.types';
import { TrackingStatusBadge } from './TrackingStatusBadge';
import { TrackingTimeline } from './TrackingTimeline';

interface TrackingResultsProps {
  orders: PublicTrackingOrder[];
  /** Lookup key used, for the "no results" message. */
  lookupLabel: string;
}

/**
 * Renders the returned tracking orders. Each order card shows the reference,
 * payment wording, overall status badge and the delivery timeline.
 */
export function TrackingResults({ orders, lookupLabel }: TrackingResultsProps) {
  if (orders.length === 0) {
    return (
      <div className="rounded-2xl border border-white/10 bg-[#082017]/70 p-6 text-center">
        <p className="text-sm text-[#94a3b8]">
          No orders found for that {lookupLabel}. Double-check and try again.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {orders.map((order) => (
        <div
          key={order.orderRef}
          className="rounded-2xl border border-white/10 bg-[#082017]/70 p-6 backdrop-blur-sm"
        >
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-medium text-white">
                Order {order.orderRef}
              </h2>
              <p className="text-xs text-[#94a3b8]">{order.payment}</p>
            </div>
            <TrackingStatusBadge status={order.status} />
          </div>
          <TrackingTimeline events={order.events} />
        </div>
      ))}
    </div>
  );
}
