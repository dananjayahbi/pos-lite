import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

export function useCompleteAppointment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/store/appointments/${id}/complete`, { method: 'POST' });
      const json = await res.json();
      if (!json.success) throw new Error(json.error?.message ?? 'Failed to complete appointment');
      return json.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['appointments'] });
      queryClient.invalidateQueries({ queryKey: ['appointment'] });
      toast.success('Appointment completed');
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });
}
