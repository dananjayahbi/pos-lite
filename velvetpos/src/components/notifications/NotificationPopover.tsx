'use client';

import { useRouter } from 'next/navigation';
import {
  Bell,
  AlertTriangle,
  ClipboardList,
  CheckCircle2,
  XCircle,
  Info,
} from 'lucide-react';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { useGetNotifications, useInvalidateNotifications } from '@/hooks/useGetNotifications';

// ── Helpers ──────────────────────────────────────────────────────────────────

function formatRelativeTime(dateStr: string): string {
  const now = Date.now();
  const date = new Date(dateStr).getTime();
  const diff = now - date;
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days === 1) return 'Yesterday';
  if (days < 7) return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString();
}

const TYPE_ICONS: Record<string, typeof Bell> = {
  LOW_STOCK_ALERT: AlertTriangle,
  STOCK_TAKE_SUBMITTED: ClipboardList,
  STOCK_TAKE_APPROVED: CheckCircle2,
  STOCK_TAKE_REJECTED: XCircle,
  SYSTEM_ALERT: Info,
};

function getNotificationHref(type: string, relatedEntityId: string | null): string | null {
  switch (type) {
    case 'LOW_STOCK_ALERT':
      return '/stock-control/low-stock';
    case 'STOCK_TAKE_SUBMITTED':
    case 'STOCK_TAKE_APPROVED':
    case 'STOCK_TAKE_REJECTED':
      return relatedEntityId
        ? `/stock-control/stock-takes/${relatedEntityId}/review`
        : null;
    default:
      return null;
  }
}

// ── Component ────────────────────────────────────────────────────────────────

export function NotificationPopover() {
  const router = useRouter();
  const { data } = useGetNotifications();
  const invalidate = useInvalidateNotifications();

  const notifications = data?.data?.notifications ?? [];
  const unreadCount = data?.data?.unreadCount ?? 0;

  const handleMarkAllRead = async () => {
    await fetch('/api/notifications/read-all', { method: 'PATCH' });
    invalidate();
  };

  const handleNotificationClick = async (
    id: string,
    type: string,
    relatedEntityId: string | null,
    isRead: boolean,
  ) => {
    if (!isRead) {
      await fetch(`/api/notifications/${id}/read`, { method: 'PATCH' });
      invalidate();
    }
    const href = getNotificationHref(type, relatedEntityId);
    if (href) router.push(href);
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="h-5 w-5 text-espresso" />
          {unreadCount > 0 && (
            <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-[#9B2226] px-1 font-mono text-[10px] font-bold text-white">
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[380px] p-0" align="end">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-sand/40 px-4 py-3">
          <h3 className="font-display text-sm font-semibold text-espresso">
            Notifications
          </h3>
          {unreadCount > 0 && (
            <button
              onClick={handleMarkAllRead}
              className="font-body text-xs font-medium text-terracotta hover:underline"
            >
              Mark all as read
            </button>
          )}
        </div>

        {/* List */}
        <div className="max-h-[360px] overflow-y-auto">
          {notifications.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-10">
              <Bell className="h-8 w-8 text-mist" />
              <p className="font-body text-sm text-mist">
                You&apos;re all caught up!
              </p>
            </div>
          ) : (
            notifications.map((n) => {
              const Icon = TYPE_ICONS[n.type] ?? Info;
              return (
                <button
                  key={n.id}
                  onClick={() =>
                    handleNotificationClick(n.id, n.type, n.relatedEntityId, n.isRead)
                  }
                  className={`flex w-full gap-3 px-4 py-3 text-left transition-colors hover:bg-linen/60 ${
                    !n.isRead ? 'bg-pearl/60' : ''
                  }`}
                >
                  <div className="mt-0.5 shrink-0">
                    <Icon className="h-4 w-4 text-terracotta" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-body text-sm font-medium text-espresso">
                      {n.title}
                    </p>
                    <p className="mt-0.5 line-clamp-2 font-body text-xs text-mist">
                      {n.body}
                    </p>
                    <p className="mt-1 font-mono text-[10px] text-mist/70">
                      {formatRelativeTime(n.createdAt)}
                    </p>
                  </div>
                  {!n.isRead && (
                    <div className="mt-1.5 shrink-0">
                      <div className="h-2 w-2 rounded-full bg-[#9B2226]" />
                    </div>
                  )}
                </button>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-sand/40 px-4 py-2">
          <button
            onClick={() => router.push('/notifications')}
            className="w-full text-center font-body text-xs font-medium text-terracotta hover:underline"
          >
            View all notifications →
          </button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
