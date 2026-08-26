'use client';

import { Check, Circle, X } from 'lucide-react';

const STEPS = [
  { key: 'SCHEDULED', label: 'Scheduled' },
  { key: 'CONFIRMED', label: 'Confirmed' },
  { key: 'CHECKED_IN', label: 'Checked In' },
  { key: 'IN_PROGRESS', label: 'In Progress' },
  { key: 'COMPLETED', label: 'Completed' },
];

const STATUS_ORDER = ['SCHEDULED', 'CONFIRMED', 'CHECKED_IN', 'IN_PROGRESS', 'COMPLETED'];

export function AppointmentStatusTimeline({ status }: { status: string }) {
  const currentIdx = STATUS_ORDER.indexOf(status);

  return (
    <div className="flex items-center gap-1 py-2">
      {STEPS.map((step, idx) => {
        const isComplete = idx <= currentIdx && currentIdx !== -1;
        const isCurrent = idx === currentIdx;
        const isCancelled = status === 'CANCELLED';
        const isNoShow = status === 'NO_SHOW';

        return (
          <div key={step.key} className="flex items-center gap-1 flex-1">
            <div className="flex flex-col items-center">
              <div
                className={`flex h-6 w-6 items-center justify-center rounded-full text-xs ${
                  isCancelled || (isNoShow && idx > 0)
                    ? 'bg-gray-100 text-gray-400'
                    : isComplete
                    ? 'bg-green-100 text-green-600'
                    : 'bg-espresso/5 text-espresso/30'
                }`}
              >
                {isCancelled ? <X className="h-3 w-3" /> : isComplete ? <Check className="h-3 w-3" /> : <Circle className="h-3 w-3" />}
              </div>
              <span className="text-[10px] text-espresso/40 mt-0.5">{step.label}</span>
            </div>
            {idx < STEPS.length - 1 && (
              <div className={`flex-1 h-0.5 ${idx < currentIdx && !isCancelled ? 'bg-green-200' : 'bg-espresso/10'}`} />
            )}
          </div>
        );
      })}
    </div>
  );
}
