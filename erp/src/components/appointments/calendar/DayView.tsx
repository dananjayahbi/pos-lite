'use client';

import { useAppointments } from '@/hooks/appointments';
import { CalendarAppointmentCard } from './CalendarAppointmentCard';

interface DayViewProps {
  currentDate: Date;
  onAppointmentClick: (id: string) => void;
  onSlotClick: (date: Date, hour: number) => void;
}

export function DayView({ currentDate, onAppointmentClick, onSlotClick }: DayViewProps) {
  const dateStr = currentDate.toISOString().split('T')[0];
  const startOfDay = new Date(currentDate);
  startOfDay.setHours(0, 0, 0, 0);
  const endOfDay = new Date(currentDate);
  endOfDay.setHours(23, 59, 59, 999);

  const { data } = useAppointments({
    dateFrom: startOfDay.toISOString(),
    dateTo: endOfDay.toISOString(),
  });

  const appointments = (data?.appointments ?? []) as Array<{ id: string; title: string; status: string; startTime: string; endTime: string; customer?: { name: string } | null; walkInName?: string | null }>;
  const hours = Array.from({ length: 24 }, (_, i) => i);

  return (
    <div className="overflow-auto max-h-[calc(100vh-280px)]">
      <div className="grid grid-cols-[60px_1fr]">
        {hours.map((hour) => {
          const hourStart = new Date(currentDate);
          hourStart.setHours(hour, 0, 0, 0);
          const hourEnd = new Date(hourStart);
          hourEnd.setHours(hour + 1, 0, 0, 0);

          const hourAppts = appointments.filter((a) => {
            const aStart = new Date(a.startTime);
            return aStart >= hourStart && aStart < hourEnd;
          });

          return (
            <div key={hour} className="contents">
              <div className="border-r border-b border-espresso/10 px-2 py-2 text-xs text-espresso/50 text-right pr-3">
                {hour.toString().padStart(2, '0')}:00
              </div>
              <div
                className="border-b border-espresso/10 min-h-[60px] p-1 cursor-pointer hover:bg-espresso/5 transition-colors"
                onClick={() => onSlotClick(currentDate, hour)}
              >
                <div className="flex flex-col gap-1">
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
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
