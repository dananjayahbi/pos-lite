import { useQuery } from '@tanstack/react-query';

export function useStaffTimeOff(staffId?: string, dateFrom?: string, dateTo?: string) {
  const params = new URLSearchParams();
  if (staffId) params.set('staffId', staffId);
  if (dateFrom) params.set('dateFrom', dateFrom);
  if (dateTo) params.set('dateTo', dateTo);

  return useQuery({
    queryKey: ['staff-time-off', staffId, dateFrom, dateTo],
    queryFn: async () => {
      const res = await fetch(`/api/store/appointments/time-off?${params}`);
      const json = await res.json();
      if (!json.success) throw new Error(json.error?.message ?? 'Failed to fetch time off');
      return json.data;
    },
  });
}
