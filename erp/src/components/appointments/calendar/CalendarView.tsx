'use client';

import { useAppointmentStore, type CalendarView as CV } from '@/stores/appointmentStore';
import { useMounted } from '@/hooks/useMounted';
import { CalendarHeader } from './CalendarHeader';
import { DayView } from './DayView';
import { WeekView } from './WeekView';
import { MonthView } from './MonthView';

interface CalendarViewProps {
  onAppointmentClick: (id: string) => void;
  onSlotClick: (date: Date, hour?: number) => void;
}

export function CalendarView({ onAppointmentClick, onSlotClick }: CalendarViewProps) {
  const mounted = useMounted();
  const currentDate = useAppointmentStore((s) => s.currentDate);
  const calendarView = useAppointmentStore((s) => s.calendarView);
  const setCurrentDate = useAppointmentStore((s) => s.setCurrentDate);
  const setCalendarView = useAppointmentStore((s) => s.setCalendarView);
  const next = useAppointmentStore((s) => s.next);
  const previous = useAppointmentStore((s) => s.previous);
  const goToToday = useAppointmentStore((s) => s.goToToday);

  const handleViewChange = (view: CV) => {
    setCalendarView(view);
  };

  const handleSlotClick = (date: Date, hour?: number) => {
    const slotDate = new Date(date);
    if (hour !== undefined) {
      slotDate.setHours(hour, 0, 0, 0);
    }
    onSlotClick(slotDate, hour);
  };

  const handleDayClick = (date: Date) => {
    setCurrentDate(date);
    setCalendarView('day');
    onSlotClick(date);
  };

  // The Zustand store seeds `currentDate` with `new Date()`, which evaluates to
  // a DIFFERENT date on the server (UTC) than the client (local tz). To avoid an
  // SSR hydration mismatch in the header, render a deterministic skeleton until
  // the client has mounted, then swap in the store's live date.
  if (!mounted) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-2">
            <div className="h-9 w-9 rounded-md border border-espresso/10" />
            <div className="h-6 w-[200px] rounded bg-espresso/10 animate-pulse" />
            <div className="h-9 w-9 rounded-md border border-espresso/10" />
          </div>
          <div className="h-8 w-48 rounded-lg border border-espresso/10" />
        </div>
        <div className="h-[calc(100vh-280px)] rounded-lg bg-espresso/5 animate-pulse" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <CalendarHeader
        currentDate={currentDate}
        calendarView={calendarView}
        onPrevious={previous}
        onNext={next}
        onToday={goToToday}
        onViewChange={handleViewChange}
      />
      {calendarView === 'day' && (
        <DayView
          currentDate={currentDate}
          onAppointmentClick={onAppointmentClick}
          onSlotClick={handleSlotClick}
        />
      )}
      {calendarView === 'week' && (
        <WeekView
          currentDate={currentDate}
          onAppointmentClick={onAppointmentClick}
          onSlotClick={handleSlotClick}
        />
      )}
      {calendarView === 'month' && (
        <MonthView
          currentDate={currentDate}
          onDayClick={handleDayClick}
          onAppointmentClick={onAppointmentClick}
        />
      )}
    </div>
  );
}
