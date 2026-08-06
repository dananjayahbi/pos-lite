import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

export function useConvertToSale() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/store/appointments/${id}/convert-to-sale`, { method: 'POST' });
      const json = await res.json();
      if (!json.success) throw new Error(json.error?.message ?? 'Failed to convert to sale');
      return json.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['appointments'] });
      queryClient.invalidateQueries({ queryKey: ['appointment'] });
      toast.success('Converted to sale');
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });
}
