'use client';

import { useMemo } from 'react';
import { useAppointments } from '@/hooks/appointments';
import { CalendarAppointmentCard } from './CalendarAppointmentCard';

interface WeekViewProps {
  currentDate: Date;
  onAppointmentClick: (id: string) => void;
  onSlotClick: (date: Date, hour: number) => void;
}

export function WeekView({ currentDate, onAppointmentClick, onSlotClick }: WeekViewProps) {
  const days = useMemo(() => {
    const startOfWeek = new Date(currentDate);
    startOfWeek.setDate(startOfWeek.getDate() - startOfWeek.getDay());
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(startOfWeek);
      d.setDate(d.getDate() + i);
      return d;
    });
  }, [currentDate]);

  const startDate = days[0]!;
  const endDate = new Date(days[6]!);
  endDate.setHours(23, 59, 59, 999);

  const { data } = useAppointments({
    dateFrom: startDate.toISOString(),
    dateTo: endDate.toISOString(),
  });

  const appointments = (data?.appointments ?? []) as Array<{ id: string; title: string; status: string; startTime: string; endTime: string; customer?: { name: string } | null; walkInName?: string | null }>;
  const hours = Array.from({ length: 14 }, (_, i) => i + 8); // 8am to 9pm

  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  return (
    <div className="overflow-auto max-h-[calc(100vh-280px)]">
      <div className="grid" style={{ gridTemplateColumns: `60px repeat(7, 1fr)` }}>
        {/* Header row */}
        <div className="border-r border-b border-espresso/10 p-2" />
        {days.map((day, i) => (
          <div key={i} className="border-r border-b border-espresso/10 p-2 text-center">
            <div className="text-xs text-espresso/50">{dayNames[day.getDay()]}</div>
            <div className="text-sm font-semibold text-espresso">{day.getDate()}</div>
          </div>
        ))}

        {/* Time rows */}
        {hours.map((hour) => (
          <div key={hour} className="contents">
            <div className="border-r border-b border-espresso/10 px-2 py-1 text-xs text-espresso/50 text-right">
              {hour.toString().padStart(2, '0')}:00
            </div>
            {days.map((day) => {
              const hourStart = new Date(day);
              hourStart.setHours(hour, 0, 0, 0);
              const hourEnd = new Date(hourStart);
              hourEnd.setHours(hour + 1, 0, 0, 0);

              const hourAppts = appointments.filter((a) => {
                const aStart = new Date(a.startTime);
                return aStart >= hourStart && aStart < hourEnd;
              });

              return (
                <div
                  key={day.getTime()}
                  className="border-r border-b border-espresso/10 min-h-[50px] p-0.5 cursor-pointer hover:bg-espresso/5 transition-colors"
                  onClick={() => onSlotClick(day, hour)}
                >
                  {hourAppts.map((appt) => (
                    <CalendarAppointmentCard
                      key={appt.id}
                      id={appt.id}
                      title={appt.title}
                      status={appt.status}
                      startTime={appt.startTime}
                      endTime={appt.endTime}
                      customerName={appt.customer?.name ?? null}
                      walkInName={appt.walkInName ?? null}
                      onClick={onAppointmentClick}
                    />
                  ))}
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}
