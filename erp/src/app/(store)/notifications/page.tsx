'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  AlertTriangle,
  Bell,
  Check,
  CheckCheck,
  CheckCircle2,
  ClipboardList,
  Info,
  XCircle,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useGetNotifications, useInvalidateNotifications } from '@/hooks/useGetNotifications';

type NotificationStatusFilter = 'all' | 'read' | 'unread';

const TYPE_ICONS = {
  LOW_STOCK_ALERT: AlertTriangle,
  STOCK_TAKE_SUBMITTED: ClipboardList,
  STOCK_TAKE_APPROVED: CheckCircle2,
  STOCK_TAKE_REJECTED: XCircle,
  SYSTEM_ALERT: Info,
} as const;

function formatRelativeTime(dateStr: string): string {
  const now = Date.now();
  const date = new Date(dateStr).getTime();
  const diff = now - date;
  const minutes = Math.floor(diff / 60_000);
  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days === 1) return 'Yesterday';
  if (days < 7) return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString('en-LK');
}

function getNotificationHref(type: string, relatedEntityId: string | null): string | null {
  switch (type) {
    case 'LOW_STOCK_ALERT':
      return '/stock-control/low-stock';
    case 'STOCK_TAKE_SUBMITTED':
    case 'STOCK_TAKE_APPROVED':
    case 'STOCK_TAKE_REJECTED':
      return relatedEntityId ? `/stock-control/stock-takes/${relatedEntityId}/review` : null;
    default:
      return null;
  }
}

export default function NotificationsPage() {
  const router = useRouter();
  const invalidate = useInvalidateNotifications();
  const [status, setStatus] = useState<NotificationStatusFilter>('all');
  const [page, setPage] = useState(1);

  const { data, isLoading } = useGetNotifications({ status, page, limit: 20 });
  const notifications = data?.data.notifications ?? [];
  const unreadCount = data?.data.unreadCount ?? 0;
  const meta = data?.meta;

  async function handleMarkAllRead() {
    const res = await fetch('/api/notifications/read-all', { method: 'PATCH' });
    if (res.ok) {
      invalidate();
    }
  }

  async function handleMarkRead(id: string) {
    const res = await fetch(`/api/notifications/${id}/read`, { method: 'PATCH' });
    if (res.ok) {
      invalidate();
    }
  }

  async function handleOpen(id: string, type: string, relatedEntityId: string | null, isRead: boolean) {
    if (!isRead) {
      await handleMarkRead(id);
    }
    const href = getNotificationHref(type, relatedEntityId);
    if (href) {
      router.push(href);
    }
  }

  return (
    <div className="space-y-6 p-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold text-espresso">Notifications</h1>
          <p className="mt-1 text-sm text-sand">
            Review store alerts, stock-take approvals, and operational nudges without playing notification hide-and-seek.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          {(['all', 'unread', 'read'] as NotificationStatusFilter[]).map((filter) => (
            <Button
              key={filter}
              variant={status === filter ? 'default' : 'outline'}
              onClick={() => {
                setStatus(filter);
                setPage(1);
              }}
              className={status === filter ? 'bg-espresso text-pearl hover:bg-espresso/90' : ''}
            >
              {filter === 'all' ? 'All' : filter === 'unread' ? 'Unread' : 'Read'}
            </Button>
          ))}

          <Button variant="outline" onClick={handleMarkAllRead} disabled={unreadCount === 0}>
            <CheckCheck className="mr-2 h-4 w-4" />
            Mark all read
          </Button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-sand">Unread right now</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="font-display text-3xl text-espresso">{unreadCount}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-sand">Showing</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="font-display text-3xl text-espresso">{notifications.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-sand">Filter</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="font-display text-2xl text-espresso capitalize">{status}</p>
          </CardContent>
        </Card>
      </div>

      <Card className="border-mist">
        <CardContent className="space-y-3 p-4">
          {isLoading ? (
            Array.from({ length: 6 }).map((_, index) => (
              <Skeleton key={index} className="h-24 w-full" />
            ))
          ) : notifications.length === 0 ? (
            <div className="flex flex-col items-center gap-3 py-16 text-center">
              <Bell className="h-10 w-10 text-mist" />
              <div>
                <p className="font-medium text-espresso">No notifications in this view</p>
                <p className="mt-1 text-sm text-sand">Switch filters or wait for the next event to land.</p>
              </div>
            </div>
          ) : (
            notifications.map((notification) => {
              const Icon = TYPE_ICONS[notification.type as keyof typeof TYPE_ICONS] ?? Info;
              const href = getNotificationHref(notification.type, notification.relatedEntityId);

              return (
                <div
                  key={notification.id}
                  className={`rounded-xl border p-4 ${notification.isRead ? 'border-mist bg-white' : 'border-terracotta/20 bg-pearl/60'}`}
                >
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                    <div className="flex gap-3">
                      <div className="mt-0.5 rounded-full bg-linen p-2 text-terracotta">
                        <Icon className="h-4 w-4" />
                      </div>
                      <div className="space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="font-medium text-espresso">{notification.title}</p>
                          {!notification.isRead && <Badge className="bg-terracotta text-pearl">Unread</Badge>}
                        </div>
                        <p className="text-sm text-sand">{notification.body}</p>
                        <p className="font-mono text-xs text-mist">{formatRelativeTime(notification.createdAt)}</p>
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-2 lg:justify-end">
                      {!notification.isRead && (
                        <Button variant="outline" size="sm" onClick={() => handleMarkRead(notification.id)}>
                          <Check className="mr-2 h-4 w-4" />
                          Mark read
                        </Button>
                      )}
                      {href && (
                        <Button size="sm" onClick={() => handleOpen(notification.id, notification.type, notification.relatedEntityId, notification.isRead)}>
                          Open
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </CardContent>
      </Card>

      {meta && meta.total > meta.limit && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-sand">
            Page {meta.page} · {meta.total} total notifications
          </p>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((current) => current - 1)}>
              Previous
            </Button>
            <Button variant="outline" size="sm" disabled={!meta.hasMore} onClick={() => setPage((current) => current + 1)}>
              Next
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
