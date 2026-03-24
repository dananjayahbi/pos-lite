'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { ArrowLeft, PieChart, Send } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';

interface BroadcastHistoryItem {
  id: string;
  message: string;
  sentAt: string;
  recipientCount: number;
  sentByEmail: string;
  criteria: Record<string, unknown>;
  analytics: Record<string, unknown>;
}

function n(value: unknown, fallback = 0) {
  return typeof value === 'number' ? value : fallback;
}

export default function BroadcastHistoryPage() {
  const [selected, setSelected] = useState<BroadcastHistoryItem | null>(null);
  const { data, isLoading } = useQuery<{ success: boolean; data: BroadcastHistoryItem[] }>({
    queryKey: ['broadcast-history'],
    queryFn: async () => {
      const res = await fetch('/api/broadcast/history');
      if (!res.ok) throw new Error('Failed to fetch broadcast history');
      return res.json();
    },
  });

  const broadcasts = data?.data ?? [];

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/customers/broadcast">
            <ArrowLeft className="h-5 w-5" />
          </Link>
        </Button>
        <div>
          <h1 className="font-display text-2xl font-bold text-espresso">Broadcast History</h1>
          <p className="mt-1 text-sm text-sand">Review recent WhatsApp sends, success rates, and failure reasons after submission.</p>
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, index) => <Skeleton key={index} className="h-28 w-full" />)}
        </div>
      ) : broadcasts.length === 0 ? (
        <Card className="border-mist">
          <CardContent className="py-16 text-center text-sand">No broadcasts sent yet.</CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {broadcasts.map((broadcast) => {
            const sent = n(broadcast.analytics.sent, broadcast.recipientCount);
            const failed = n(broadcast.analytics.failed, 0);
            const total = n(broadcast.analytics.total, broadcast.recipientCount);
            const successRate = total > 0 ? Math.round((sent / total) * 100) : 0;

            return (
              <Card key={broadcast.id} className="border-mist">
                <CardContent className="flex flex-col gap-4 p-4 lg:flex-row lg:items-start lg:justify-between">
                  <div className="space-y-2">
                    <p className="line-clamp-2 font-medium text-espresso">{broadcast.message}</p>
                    <p className="text-xs text-sand">Sent {new Date(broadcast.sentAt).toLocaleString()} by {broadcast.sentByEmail}</p>
                    <div className="flex flex-wrap gap-2 text-xs text-sand">
                      <span className="rounded-full bg-pearl px-2 py-1">Recipients {broadcast.recipientCount}</span>
                      <span className="rounded-full bg-pearl px-2 py-1">Sent {sent}</span>
                      <span className="rounded-full bg-pearl px-2 py-1">Failed {failed}</span>
                      <span className="rounded-full bg-pearl px-2 py-1">Success {successRate}%</span>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button variant="outline" onClick={() => setSelected(broadcast)}>
                      View analytics
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <Dialog open={selected !== null} onOpenChange={(open) => !open && setSelected(null)}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle className="font-display text-espresso">Broadcast Analytics</DialogTitle>
          </DialogHeader>
          {selected && (() => {
            const sent = n(selected.analytics.sent, selected.recipientCount);
            const failed = n(selected.analytics.failed, 0);
            const total = n(selected.analytics.total, selected.recipientCount);
            const successRate = total > 0 ? Math.round((sent / total) * 100) : 0;
            const chart = `conic-gradient(#3A2D28 0 ${successRate}%, #D1C7BD ${successRate}% 100%)`;
            const errorList = Array.isArray(selected.analytics.errors) ? selected.analytics.errors.filter((value): value is string => typeof value === 'string') : [];
            return (
              <div className="space-y-5">
                <p className="text-sm text-sand">{selected.message}</p>
                <div className="grid gap-4 md:grid-cols-[160px_minmax(0,1fr)]">
                  <div className="flex flex-col items-center justify-center rounded-lg border border-mist bg-pearl/40 p-4">
                    <div className="flex h-24 w-24 items-center justify-center rounded-full" style={{ background: chart }}>
                      <div className="flex h-14 w-14 items-center justify-center rounded-full bg-white text-sm font-semibold text-espresso">
                        {successRate}%
                      </div>
                    </div>
                    <div className="mt-3 flex items-center gap-2 text-xs text-sand">
                      <PieChart className="h-4 w-4" /> success rate
                    </div>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="rounded-lg border border-mist p-4"><p className="text-xs uppercase tracking-[0.2em] text-sand">Recipients</p><p className="mt-2 font-display text-3xl text-espresso">{selected.recipientCount}</p></div>
                    <div className="rounded-lg border border-mist p-4"><p className="text-xs uppercase tracking-[0.2em] text-sand">Sent</p><p className="mt-2 font-display text-3xl text-espresso">{sent}</p></div>
                    <div className="rounded-lg border border-mist p-4"><p className="text-xs uppercase tracking-[0.2em] text-sand">Failed</p><p className="mt-2 font-display text-3xl text-espresso">{failed}</p></div>
                    <div className="rounded-lg border border-mist p-4"><p className="text-xs uppercase tracking-[0.2em] text-sand">Operator</p><p className="mt-2 text-sm text-espresso">{selected.sentByEmail}</p></div>
                  </div>
                </div>

                <Card className="border-mist">
                  <CardHeader><CardTitle className="text-base text-espresso">Targeting snapshot</CardTitle></CardHeader>
                  <CardContent className="font-mono text-xs text-sand break-all">
                    {JSON.stringify(selected.criteria ?? {}, null, 2)}
                  </CardContent>
                </Card>

                <Card className="border-mist">
                  <CardHeader><CardTitle className="text-base text-espresso">Failure sample</CardTitle></CardHeader>
                  <CardContent className="space-y-2">
                    {errorList.length === 0 ? (
                      <p className="text-sm text-sand">No failures recorded in the stored analytics payload.</p>
                    ) : (
                      errorList.map((error, index) => (
                        <div key={index} className="rounded-md border border-mist bg-pearl/30 px-3 py-2 text-sm text-sand">{error}</div>
                      ))
                    )}
                  </CardContent>
                </Card>
              </div>
            );
          })()}
        </DialogContent>
      </Dialog>
    </div>
  );
}
