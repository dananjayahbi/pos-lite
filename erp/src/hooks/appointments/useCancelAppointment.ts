import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

export function useCancelAppointment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, reason }: { id: string; reason?: string }) => {
      const res = await fetch(`/api/store/appointments/${id}/cancel`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error?.message ?? 'Failed to cancel appointment');
      return json.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['appointments'] });
      queryClient.invalidateQueries({ queryKey: ['appointment'] });
      toast.success('Appointment cancelled');
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });
}
