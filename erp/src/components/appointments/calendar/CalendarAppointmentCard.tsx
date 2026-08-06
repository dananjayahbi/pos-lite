'use client';

const STATUS_BORDER_COLORS: Record<string, string> = {
  SCHEDULED: 'border-l-blue-500',
  CONFIRMED: 'border-l-indigo-500',
  CHECKED_IN: 'border-l-amber-500',
  IN_PROGRESS: 'border-l-violet-500',
  COMPLETED: 'border-l-green-500',
  NO_SHOW: 'border-l-red-500',
  CANCELLED: 'border-l-gray-400',
};

interface CalendarAppointmentCardProps {
  id: string;
  title: string;
  status: string;
  startTime: string;
  endTime: string;
  customerName?: string | null;
  walkInName?: string | null;
  onClick?: (id: string) => void;
}

export function CalendarAppointmentCard({
  id, title, status, startTime, endTime, customerName, walkInName, onClick,
}: CalendarAppointmentCardProps) {
  const name = customerName ?? walkInName ?? 'Walk-in';
  const borderColor = STATUS_BORDER_COLORS[status] ?? 'border-l-gray-400';

  const timeStr = new Date(startTime).toLocaleTimeString('en-US', {
    hour: '2-digit', minute: '2-digit', hour12: false,
  });

  return (
    <div
      className={`cursor-pointer rounded border-l-4 bg-white p-2 text-xs shadow-sm transition hover:shadow-md ${borderColor}`}
      onClick={() => onClick?.(id)}
    >
      <div className="font-medium text-espresso truncate">{title}</div>
      <div className="text-espresso/50">{timeStr}</div>
      <div className="text-espresso/60 truncate">{name}</div>
    </div>
  );
}
