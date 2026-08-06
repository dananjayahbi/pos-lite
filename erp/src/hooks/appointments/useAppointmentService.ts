import { useQuery } from '@tanstack/react-query';

export function useAppointmentService(id: string | null) {
  return useQuery({
    queryKey: ['appointment-service', id],
    queryFn: async () => {
      const res = await fetch(`/api/store/appointments/services/${id}`);
      const json = await res.json();
      if (!json.success) throw new Error(json.error?.message ?? 'Failed to fetch service');
      return json.data;
    },
    enabled: !!id,
  });
}
