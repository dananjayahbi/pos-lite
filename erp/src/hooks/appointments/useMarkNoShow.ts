import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

export function useMarkNoShow() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/store/appointments/${id}/no-show`, { method: 'POST' });
      const json = await res.json();
      if (!json.success) throw new Error(json.error?.message ?? 'Failed to mark as no-show');
      return json.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['appointments'] });
      queryClient.invalidateQueries({ queryKey: ['appointment'] });
      toast.success('Marked as no-show');
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });
}
