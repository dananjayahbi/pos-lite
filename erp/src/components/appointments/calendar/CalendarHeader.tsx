'use client';

import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import type { CalendarView } from '@/stores/appointmentStore';

interface CalendarHeaderProps {
  currentDate: Date;
  calendarView: CalendarView;
  onPrevious: () => void;
  onNext: () => void;
  onToday: () => void;
  onViewChange: (view: CalendarView) => void;
}

function formatHeader(date: Date, view: CalendarView): string {
  const opts: Intl.DateTimeFormatOptions = {};
  if (view === 'day') {
    opts.weekday = 'long'; opts.month = 'long'; opts.day = 'numeric'; opts.year = 'numeric';
  } else if (view === 'week') {
    const start = new Date(date);
    start.setDate(start.getDate() - start.getDay());
    const end = new Date(start);
    end.setDate(end.getDate() + 6);
    return `${start.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - ${end.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`;
  } else {
    opts.month = 'long'; opts.year = 'numeric';
  }
  return date.toLocaleDateString('en-US', opts);
}

export function CalendarHeader({
  currentDate, calendarView, onPrevious, onNext, onToday, onViewChange,
}: CalendarHeaderProps) {
  return (
    <div className="flex items-center justify-between gap-4 flex-wrap">
      <div className="flex items-center gap-2">
        <Button variant="outline" size="icon" onClick={onPrevious}>
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <h2 className="text-lg font-semibold text-espresso min-w-[200px] text-center">
          {formatHeader(currentDate, calendarView)}
        </h2>
        <Button variant="outline" size="icon" onClick={onNext}>
          <ChevronRight className="h-4 w-4" />
        </Button>
        <Button variant="ghost" size="sm" onClick={onToday}>Today</Button>
      </div>
      <div className="flex rounded-lg border border-espresso/10 p-0.5">
        {(['day', 'week', 'month'] as const).map((v) => (
          <Button
            key={v}
            variant={calendarView === v ? 'default' : 'ghost'}
            size="sm"
            className="capitalize"
            onClick={() => onViewChange(v)}
          >
            {v}
          </Button>
        ))}
      </div>
    </div>
  );
}
