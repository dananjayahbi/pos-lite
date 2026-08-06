import { useQuery } from '@tanstack/react-query';
import type { AppointmentStatus } from '@/generated/prisma/client';

interface AppointmentFilters {
  status?: AppointmentStatus;
  staffId?: string;
  serviceId?: string;
  customerId?: string;
  dateFrom?: string;
  dateTo?: string;
  page?: number;
  limit?: number;
}

export function useAppointments(filters: AppointmentFilters = {}) {
  const params = new URLSearchParams();
  Object.entries(filters).forEach(([key, value]) => {
    if (value !== undefined && value !== null) params.set(key, String(value));
  });

  return useQuery({
    queryKey: ['appointments', filters],
    queryFn: async () => {
      const res = await fetch(`/api/store/appointments?${params}`);
      const json = await res.json();
      if (!json.success) throw new Error(json.error?.message ?? 'Failed to fetch appointments');
      return json.data as { appointments: unknown[]; total: number; page: number; limit: number };
    },
    staleTime: 30_000,
  });
}
