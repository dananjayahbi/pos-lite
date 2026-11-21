import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

export function useConfirmAppointment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/store/appointments/${id}/confirm`, { method: 'POST' });
      const json = await res.json();
      if (!json.success) throw new Error(json.error?.message ?? 'Failed to confirm appointment');
      return json.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['appointments'] });
      queryClient.invalidateQueries({ queryKey: ['appointment'] });
      toast.success('Appointment confirmed');
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });
}
