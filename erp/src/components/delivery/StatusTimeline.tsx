'use client';

import type { DeliveryEvent } from '@/types/delivery';
import { formatShortDateTime } from '@/lib/format';

interface StatusTimelineProps {
  events: DeliveryEvent[];
}

function formatDate(value: string) {
  return formatShortDateTime(value);
}

export function StatusTimeline({ events }: StatusTimelineProps) {
  if (!events || events.length === 0) {
    return <p className="py-4 text-sm text-espresso/50">No status updates yet.</p>;
  }

  const sorted = [...events].sort(
    (a, b) => new Date(b.eventAt).getTime() - new Date(a.eventAt).getTime(),
  );

  return (
    <ol className="relative border-l border-espresso/10 ml-2 space-y-5">
      {sorted.map((event) => (
        <li key={event.id ?? event.eventAt} className="ml-4">
          <span className="absolute -left-1.75 mt-1.5 h-3 w-3 rounded-full bg-terracotta" />
          <div className="text-sm font-medium text-espresso capitalize">
            {(event.status ?? event.carrierStatus ?? 'Unknown')
              .replace(/_/g, ' ')
              .toLowerCase()}
          </div>
          {event.remarks && (
            <p className="text-sm text-espresso/70">{event.remarks}</p>
          )}
          <p className="text-xs text-espresso/40">
            {formatDate(event.eventAt)}
            {event.source && ` · ${event.source}`}
          </p>
        </li>
      ))}
    </ol>
  );
}
