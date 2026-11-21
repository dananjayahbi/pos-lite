import { useQuery } from '@tanstack/react-query';
import type { AppointmentSettings } from '@/lib/appointments/appointmentSettings.core';

export const APPOINTMENT_SETTINGS_QUERY_KEY = ['appointment-settings'] as const;

export function useAppointmentSettings() {
  return useQuery({
    queryKey: APPOINTMENT_SETTINGS_QUERY_KEY,
    queryFn: async (): Promise<AppointmentSettings> => {
      const res = await fetch('/api/store/appointments/settings');
      const json = await res.json();
      if (!json.success) throw new Error(json.error?.message ?? 'Failed to fetch appointment settings');
      return json.data as AppointmentSettings;
    },
    staleTime: 60_000,
  });
}
