'use client';

import { useAppointmentStore, type CalendarView as CV } from '@/stores/appointmentStore';
import { CalendarHeader } from './CalendarHeader';
import { DayView } from './DayView';
import { WeekView } from './WeekView';
import { MonthView } from './MonthView';

interface CalendarViewProps {
  onAppointmentClick: (id: string) => void;
  onSlotClick: (date: Date, hour?: number) => void;
}

export function CalendarView({ onAppointmentClick, onSlotClick }: CalendarViewProps) {
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
