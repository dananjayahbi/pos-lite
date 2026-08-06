import { useQuery } from '@tanstack/react-query';

export function useAppointmentServices() {
  return useQuery({
    queryKey: ['appointment-services'],
    queryFn: async () => {
      const res = await fetch('/api/store/appointments/services');
      const json = await res.json();
      if (!json.success) throw new Error(json.error?.message ?? 'Failed to fetch services');
      return json.data;
    },
    staleTime: 60_000,
  });
}
