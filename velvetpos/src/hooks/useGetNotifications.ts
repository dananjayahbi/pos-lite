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
  meta?: {
    page: number;
    limit: number;
    total: number;
    hasMore: boolean;
  };
}

type NotificationStatusFilter = 'all' | 'read' | 'unread';

interface UseGetNotificationsOptions {
  status?: NotificationStatusFilter;
  limit?: number;
  page?: number;
}

export function useGetNotifications(options: UseGetNotificationsOptions = {}) {
  const { data: session } = useSession();
  const userId = session?.user?.id;
  const status = options.status ?? 'unread';
  const limit = options.limit ?? 10;
  const page = options.page ?? 1;

  return useQuery<NotificationsResponse>({
    queryKey: ['notifications', userId, status, limit, page],
    queryFn: async () => {
      const params = new URLSearchParams();
      params.set('status', status);
      params.set('limit', String(limit));
      params.set('page', String(page));
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
  return () => queryClient.invalidateQueries({ queryKey: ['notifications'] });
}
