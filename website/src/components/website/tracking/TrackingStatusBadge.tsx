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
    ? 'bg-red-400/10 text-red-300 border-red-400/30'
    : status.isTerminal
      ? 'bg-[#97c93e]/10 text-[#97c93e] border-[#97c93e]/30'
      : 'bg-blue-400/10 text-blue-300 border-blue-400/30';

  return (
    <span
      className={`inline-flex items-center rounded-full border px-3 py-1 text-sm font-medium ${tone}`}
    >
      {status.label}
    </span>
  );
}
