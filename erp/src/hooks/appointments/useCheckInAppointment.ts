import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

export function useCheckInAppointment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/store/appointments/${id}/check-in`, { method: 'POST' });
      const json = await res.json();
      if (!json.success) throw new Error(json.error?.message ?? 'Failed to check in');
      return json.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['appointments'] });
      queryClient.invalidateQueries({ queryKey: ['appointment'] });
      toast.success('Customer checked in');
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });
}
