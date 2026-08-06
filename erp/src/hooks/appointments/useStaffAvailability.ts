import { useQuery } from '@tanstack/react-query';

export function useStaffAvailability(staffId?: string) {
  const params = new URLSearchParams();
  if (staffId) params.set('staffId', staffId);

  return useQuery({
    queryKey: ['staff-availability', staffId],
    queryFn: async () => {
      const res = await fetch(`/api/store/appointments/availability?${params}`);
      const json = await res.json();
      if (!json.success) throw new Error(json.error?.message ?? 'Failed to fetch availability');
      return json.data;
    },
  });
}
