import { useQuery } from '@tanstack/react-query';

export function useAppointmentStats(dateFrom?: string, dateTo?: string) {
  const params = new URLSearchParams();
  if (dateFrom) params.set('dateFrom', dateFrom);
  if (dateTo) params.set('dateTo', dateTo);

  return useQuery({
    queryKey: ['appointment-stats', dateFrom, dateTo],
    queryFn: async () => {
      const res = await fetch(`/api/store/appointments/stats?${params}`);
      const json = await res.json();
      if (!json.success) throw new Error(json.error?.message ?? 'Failed to fetch stats');
      return json.data;
    },
    staleTime: 30_000,
  });
}
