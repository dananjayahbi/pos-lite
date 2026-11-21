'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Bell,
  Check,
  CheckCheck,
  XCircle,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useGetNotifications, useInvalidateNotifications } from '@/hooks/useGetNotifications';
import { getNotificationIcon } from '@/lib/constants/notification-types';
import { getNotificationHref } from '@/lib/notifications/notification-href';
import { formatNotificationTime } from '@/lib/notifications/notification-time';
import {
  SALE_VOIDED_TITLE,
  buildSaleCompletedCopy,
  buildSaleVoidedCopy,
  isVoidedSaleAlert,
} from '@/lib/notifications/sale-alert-copy';

type NotificationStatusFilter = 'all' | 'read' | 'unread';

/**
 * OBS-57 (documentation only — no behaviour change): this is a `'use client'`
 * page with no server-side auth gate of its own. The redirect for an
 * unauthenticated visitor (→ `/login?callbackUrl=/notifications`, pinned by
 * tests/32 S5) comes from the centralized proxy gate in `src/proxy.ts`: its
 * `PUBLIC_PATH_PREFIXES` allowlist does not contain `/notifications`. Keep it
 * that way — registering `/notifications` (or a parent prefix) as public would
 * expose this shell, since the client component cannot gate itself.
 *
 * M32-02 (OBS-59): the icon table is now shared with the header popover — see
 * `getNotificationIcon` in `src/lib/constants/notification-types.ts`.
 */

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

  async function handleOpen(id: string, href: string, isRead: boolean) {
    if (!isRead) {
      await handleMarkRead(id);
    }
    router.push(href);
  }

  return (
    <div className="space-y-6 p-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold text-espresso">Notifications</h1>
          <p className="mt-1 text-sm text-sand-ink">
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
            <CardTitle className="text-sm text-sand-ink">Unread right now</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="font-display text-3xl text-espresso">{unreadCount}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-sand-ink">Showing</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="font-display text-3xl text-espresso">{notifications.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-sand-ink">Filter</CardTitle>
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
              <Bell className="h-10 w-10 text-mist-ink" />
              <div>
                <p className="font-medium text-espresso">No notifications in this view</p>
                <p className="mt-1 text-sm text-sand-ink">Switch filters or wait for the next event to land.</p>
              </div>
            </div>
          ) : (
            notifications.map((notification) => {
              const isVoidedSale = isVoidedSaleAlert(notification.type, notification.relatedSale);
              const completedCopy =
                !isVoidedSale &&
                notification.type === 'SALE_COMPLETED' &&
                notification.relatedSale
                  ? buildSaleCompletedCopy(
                      notification.relatedEntityId ?? '',
                      notification.relatedSale.totalAmount,
                    )
                  : null;
              const Icon = isVoidedSale ? XCircle : getNotificationIcon(notification.type);
              const href = getNotificationHref({
                type: notification.type,
                relatedEntityId: notification.relatedEntityId,
                relatedEntityType: notification.relatedEntityType,
              });
              const title = isVoidedSale
                ? SALE_VOIDED_TITLE
                : (completedCopy?.title ?? notification.title);
              const body =
                isVoidedSale && notification.relatedSale
                  ? buildSaleVoidedCopy(
                      notification.relatedEntityId ?? '',
                      notification.relatedSale.totalAmount,
                    ).body
                  : (completedCopy?.body ?? notification.body);

              return (
                <div
                  key={notification.id}
                  className={`rounded-xl border p-4 ${notification.isRead ? 'border-mist bg-white' : 'border-terracotta/20 bg-pearl/60'}`}
                >
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                    <div className="flex gap-3">
                      <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center self-start rounded-full bg-linen text-terracotta">
                        <Icon className="h-4 w-4" />
                      </div>
                      <div className="space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="font-medium text-espresso">{title}</p>
                          {isVoidedSale && (
                            <Badge className="bg-red-100 text-red-800 hover:bg-red-100">Voided</Badge>
                          )}
                          {!notification.isRead && <Badge className="bg-terracotta text-pearl">Unread</Badge>}
                        </div>
                        <p className="text-sm text-sand-ink">{body}</p>
                        <p className="font-mono text-xs text-mist-ink">{formatNotificationTime(notification.createdAt)}</p>
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
                        <Button size="sm" onClick={() => handleOpen(notification.id, href, notification.isRead)}>
                          {isVoidedSale ? 'View sale' : 'Open'}
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
          <p className="text-sm text-sand-ink">
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
