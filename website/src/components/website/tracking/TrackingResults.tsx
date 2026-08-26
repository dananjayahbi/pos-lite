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
      <div className="rounded-lg border border-gray-200 bg-white p-6 text-center">
        <p className="text-sm text-gray-500">
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
          className="rounded-lg border border-gray-200 bg-white p-6"
        >
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-medium text-gray-900">
                Order {order.orderRef}
              </h2>
              <p className="text-xs text-gray-500">{order.payment}</p>
            </div>
            <TrackingStatusBadge status={order.status} />
          </div>
          <TrackingTimeline events={order.events} />
        </div>
      ))}
    </div>
  );
}
