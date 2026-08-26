import { useQuery } from '@tanstack/react-query';

export function useAvailableSlots(date: string | null, staffId?: string) {
  const params = new URLSearchParams();
  if (date) params.set('date', date);
  if (staffId) params.set('staffId', staffId);

  return useQuery({
    queryKey: ['available-slots', date, staffId],
    queryFn: async () => {
      const res = await fetch(`/api/store/appointments/slots?${params}`);
      const json = await res.json();
      if (!json.success) throw new Error(json.error?.message ?? 'Failed to fetch slots');
      return json.data;
    },
    enabled: !!date,
    staleTime: 15_000,
  });
}
