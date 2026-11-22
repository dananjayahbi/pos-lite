import { useQuery } from '@tanstack/react-query';
import type { ReminderStatusCounts } from '@/lib/appointments/appointmentReminders.core';

/** JSON shape of an appointment reminder row returned by the API. */
export interface AppointmentReminderRow {
  id: string;
  appointmentId: string;
  scheduledFor: string;
  sentAt: string | null;
  channel: string;
  status: string;
  errorMessage: string | null;
  appointment?: {
    id: string;
    title: string;
    startTime: string;
    walkInName: string | null;
    customer: { name: string } | null;
  } | null;
}

export interface AppointmentReminderList {
  reminders: AppointmentReminderRow[];
  summary: ReminderStatusCounts;
}

export const APPOINTMENT_REMINDERS_QUERY_KEY = ['appointment-reminders'] as const;
export const TENANT_REMINDERS_QUERY_KEY = ['tenant-appointment-reminders'] as const;

async function fetchReminders(params: URLSearchParams): Promise<AppointmentReminderList> {
  const res = await fetch(`/api/store/appointments/reminders?${params.toString()}`);
  const json = await res.json();
  if (!json.success) {
    throw new Error(json.error?.message ?? 'Failed to fetch appointment reminders');
  }
  return json.data as AppointmentReminderList;
}

/** ARGUS #135 — per-appointment reminder list with delivery status. */
export function useAppointmentReminders(appointmentId?: string | null) {
  return useQuery({
    queryKey: [...APPOINTMENT_REMINDERS_QUERY_KEY, appointmentId ?? null],
    enabled: Boolean(appointmentId),
    queryFn: () => {
      const params = new URLSearchParams();
      params.set('appointmentId', appointmentId ?? '');
      return fetchReminders(params);
    },
    staleTime: 30_000,
  });
}

/** ARGUS #135 — tenant-wide reminder queue for the Settings tab. */
export function useTenantReminders(limit = 25) {
  return useQuery({
    queryKey: [...TENANT_REMINDERS_QUERY_KEY, limit],
    queryFn: () => {
      const params = new URLSearchParams();
      params.set('limit', String(limit));
      return fetchReminders(params);
    },
    staleTime: 30_000,
  });
}
