'use client';

import React from 'react';
import type { PublicTrackingStatus } from '@/types/website.types';

interface TrackingStatusBadgeProps {
  status: PublicTrackingStatus;
}

/**
 * Overall delivery-status badge with colour coding: failure states shown
 * clearly, delivered green, everything else neutral.
 */
export function TrackingStatusBadge({ status }: TrackingStatusBadgeProps) {
  const tone = status.isFailure
    ? 'bg-red-50 text-red-700 border-red-200'
    : status.isTerminal
      ? 'bg-green-50 text-green-700 border-green-200'
      : 'bg-blue-50 text-blue-700 border-blue-200';

  return (
    <span
      className={`inline-flex items-center rounded-full border px-3 py-1 text-sm font-medium ${tone}`}
    >
      {status.label}
    </span>
  );
}
