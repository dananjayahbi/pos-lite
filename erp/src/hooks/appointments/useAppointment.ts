import { useQuery } from '@tanstack/react-query';

export function useAppointment(id: string | null) {
  return useQuery({
    queryKey: ['appointment', id],
    queryFn: async () => {
      const res = await fetch(`/api/store/appointments/${id}`);
      const json = await res.json();
      if (!json.success) throw new Error(json.error?.message ?? 'Failed to fetch appointment');
      return json.data;
    },
    enabled: !!id,
    staleTime: 30_000,
  });
}
