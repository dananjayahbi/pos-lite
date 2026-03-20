import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useSession } from 'next-auth/react';

interface NotificationData {
  id: string;
  type: string;
  title: string;
  body: string;
  relatedEntityType: string | null;
  relatedEntityId: string | null;
  isRead: boolean;
  createdAt: string;
}

interface NotificationsResponse {
  success: boolean;
  data: {
    notifications: NotificationData[];
    unreadCount: number;
  };
}

export function useGetNotifications(includeRead = false) {
  const { data: session } = useSession();
  const userId = session?.user?.id;

  return useQuery<NotificationsResponse>({
    queryKey: ['notifications', userId],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (includeRead) params.set('includeRead', 'true');
      const res = await fetch(`/api/notifications?${params.toString()}`);
      if (!res.ok) throw new Error('Failed to fetch notifications');
      return res.json();
    },
    enabled: !!userId,
    refetchInterval: 30_000,
    staleTime: 10_000,
  });
}

export function useInvalidateNotifications() {
  const queryClient = useQueryClient();
  const { data: session } = useSession();
  return () => queryClient.invalidateQueries({ queryKey: ['notifications', session?.user?.id] });
}
