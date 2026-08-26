'use client';

import { useMemo } from 'react';
import { useAppointments } from '@/hooks/appointments';

const STATUS_DOT_COLORS: Record<string, string> = {
  SCHEDULED: 'bg-blue-500',
  CONFIRMED: 'bg-indigo-500',
  CHECKED_IN: 'bg-amber-500',
  IN_PROGRESS: 'bg-violet-500',
  COMPLETED: 'bg-green-500',
  NO_SHOW: 'bg-red-500',
  CANCELLED: 'bg-gray-400',
};

interface MonthViewProps {
  currentDate: Date;
  onDayClick: (date: Date) => void;
  onAppointmentClick: (id: string) => void;
}

export function MonthView({ currentDate, onDayClick, onAppointmentClick }: MonthViewProps) {
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  const monthStart = new Date(year, month, 1);
  const monthEnd = new Date(year, month + 1, 0);

  const { data } = useAppointments({
    dateFrom: monthStart.toISOString(),
    dateTo: new Date(year, month + 1, 0, 23, 59, 59).toISOString(),
  });

  const appointments = (data?.appointments ?? []) as Array<{ id: string; title: string; status: string; startTime: string; endTime: string; customer?: { name: string } | null; walkInName?: string | null }>;

  const weeks = useMemo(() => {
    const startOfGrid = new Date(monthStart);
    startOfGrid.setDate(startOfGrid.getDate() - startOfGrid.getDay());

    const result: Date[][] = [];
    let current = new Date(startOfGrid);
    while (current <= monthEnd || result.length < 6) {
      const week: Date[] = [];
      for (let i = 0; i < 7; i++) {
        week.push(new Date(current));
        current.setDate(current.getDate() + 1);
      }
      result.push(week);
    }
    return result;
  }, [monthStart, monthEnd]);

  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  return (
    <div className="overflow-auto">
      <div className="grid grid-cols-7">
        {dayNames.map((d) => (
          <div key={d} className="border-b border-espresso/10 p-2 text-center text-xs font-medium text-espresso/50">
            {d}
          </div>
        ))}

        {weeks.map((week, wi) =>
          week.map((day, di) => {
            const isCurrentMonth = day.getMonth() === month;
            const isToday = day.toDateString() === new Date().toDateString();

            const dayAppts = appointments.filter((a) => {
              const aDate = new Date(a.startTime);
              return aDate.toDateString() === day.toDateString();
            });

            const statusCounts: Record<string, number> = {};
            dayAppts.forEach((a) => {
              statusCounts[a.status] = (statusCounts[a.status] || 0) + 1;
            });

            return (
              <div
                key={`${wi}-${di}`}
                className={`min-h-[100px] border-r border-b border-espresso/10 p-1 cursor-pointer hover:bg-espresso/5 transition-colors ${
                  !isCurrentMonth ? 'bg-espresso/5' : ''
                }`}
                onClick={() => onDayClick(day)}
              >
                <div className={`text-xs font-medium mb-1 ${isToday ? 'bg-espresso text-white rounded-full w-6 h-6 flex items-center justify-center' : 'text-espresso/70'}`}>
                  {day.getDate()}
                </div>
                <div className="flex flex-wrap gap-0.5">
                  {Object.entries(statusCounts).map(([status, count]) => (
                    <div
                      key={status}
                      className={`${STATUS_DOT_COLORS[status] ?? 'bg-gray-400'} text-white text-[10px] rounded-full w-5 h-5 flex items-center justify-center`}
                      title={`${count} ${status.toLowerCase()}`}
                    >
                      {count}
                    </div>
                  ))}
                </div>
                {dayAppts.slice(0, 3).map((appt) => (
                  <div
                    key={appt.id}
                    className={`text-[10px] truncate mt-0.5 px-1 rounded border-l-2 ${STATUS_DOT_COLORS[appt.status]?.replace('bg-', 'border-l-') ?? 'border-l-gray-400'}`}
                    onClick={(e) => { e.stopPropagation(); onAppointmentClick(appt.id); }}
                  >
                    {new Date(appt.startTime).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false })} {appt.title}
                  </div>
                ))}
                {dayAppts.length > 3 && (
                  <div className="text-[10px] text-espresso/40">+{dayAppts.length - 3} more</div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
