import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

export function useGenerateSlots() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: { startDate: string; endDate: string; staffIds?: string[] }) => {
      const res = await fetch('/api/store/appointments/slots/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error?.message ?? 'Failed to generate slots');
      return json.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['available-slots'] });
      toast.success('Slots generated');
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });
}
