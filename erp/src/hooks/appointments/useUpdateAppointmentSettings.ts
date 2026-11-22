import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import type { AppointmentSettings } from '@/lib/appointments/appointmentSettings.core';
import { APPOINTMENT_SETTINGS_QUERY_KEY } from './useAppointmentSettings';

export function useUpdateAppointmentSettings() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: AppointmentSettings): Promise<AppointmentSettings> => {
      const res = await fetch('/api/store/appointments/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.success) {
        throw new Error(json?.error?.message ?? 'Failed to save appointment settings');
      }
      return json.data as AppointmentSettings;
    },
    onSuccess: (settings) => {
      queryClient.setQueryData(APPOINTMENT_SETTINGS_QUERY_KEY, settings);
      toast.success('Appointment settings saved');
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });
}
