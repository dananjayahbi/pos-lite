'use client';

import React from 'react';
import type { PublicTrackingEvent } from '@/types/website.types';

interface TrackingTimelineProps {
  events: PublicTrackingEvent[];
}

/**
 * Vertical timeline of delivery events. Each entry shows its timestamp and
 * friendly label; the current event is highlighted.
 */
export function TrackingTimeline({ events }: TrackingTimelineProps) {
  if (events.length === 0) {
    return <p className="text-sm text-[#94a3b8]">No delivery updates yet.</p>;
  }

  return (
    <ol className="relative space-y-5 border-l border-white/10 pl-6">
      {events.map((event) => (
        <li key={event.id} className="relative">
          {event.isCurrent && (
            <span className="absolute -left-[1.72rem] top-1 h-3 w-3 rounded-full border-2 border-[#97c93e] bg-[#97c93e]" />
          )}
          <p
            className={`text-sm font-medium ${event.isCurrent ? 'text-white' : 'text-[#cbd5e1]'}`}
          >
            {event.label}
          </p>
          <p className="text-xs text-[#64748b]">{formatDate(event.timestamp)}</p>
          {event.remarks && (
            <p className="mt-1 text-xs text-[#94a3b8]">{event.remarks}</p>
          )}
        </li>
      ))}
    </ol>
  );
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}
