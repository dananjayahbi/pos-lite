'use client';

import { useState, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Users, ArrowLeft, Eye } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { BroadcastFilterPanel, type BroadcastFilters } from '@/components/broadcast/BroadcastFilterPanel';
import { BroadcastComposer, type ComposerChannel } from '@/components/broadcast/BroadcastComposer';
import { buildEmailHtml } from '@/lib/broadcast/templates';

interface MatchedCustomer {
  id: string;
  name: string;
  phone: string;
  email: string | null;
  tags: string[];
  totalSpend: string;
  gender: string | null;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function buildAudienceParams(filters: BroadcastFilters, channel: ComposerChannel): string {
  const params = new URLSearchParams();
  params.set('channel', channel);
  if (filters.tags.trim()) params.set('tags', filters.tags.trim());
  if (filters.gender && filters.gender !== 'ALL') params.set('gender', filters.gender);
  if (filters.minSpend) params.set('minSpend', filters.minSpend);
  if (filters.maxSpend) params.set('maxSpend', filters.maxSpend);
  if (filters.birthdayMonth && filters.birthdayMonth !== '0') {
    params.set('birthdayMonth', filters.birthdayMonth);
  }
  return params.toString();
}

const DEFAULT_FILTERS: BroadcastFilters = {
  tags: '',
  gender: 'ALL',
  minSpend: '',
  maxSpend: '',
  birthdayMonth: '0',
};

// ── Component ────────────────────────────────────────────────────────────────

export function BroadcastPageClient() {
  const router = useRouter();
  const [filters, setFilters] = useState<BroadcastFilters>(DEFAULT_FILTERS);
  const [channel, setChannel] = useState<ComposerChannel>('EMAIL');
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [html, setHtml] = useState('');
  const [imageUrls, setImageUrls] = useState<string[]>([]);
  const [isSending, setIsSending] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const isEmail = channel === 'EMAIL';

  // Auto-fetch count whenever the audience or channel changes.
  const countQuery = useQuery<{ success: boolean; data: { count: number } }>({
    queryKey: ['broadcast-count', filters, channel],
    queryFn: async () => {
      const qs = buildAudienceParams(filters, channel);
      const res = await fetch(`/api/customers/count?${qs}`);
      if (!res.ok) throw new Error('Failed to fetch count');
      return res.json();
    },
    staleTime: 10_000,
  });

  // Fetch matching customers list for preview table.
  const previewQuery = useQuery<{ success: boolean; data: MatchedCustomer[] }>({
    queryKey: ['broadcast-preview', filters, channel],
    queryFn: async () => {
      const qs = buildAudienceParams(filters, channel);
      const res = await fetch(`/api/customers/preview?${qs}`);
      if (!res.ok) throw new Error('Failed to fetch preview');
      return res.json();
    },
    staleTime: 10_000,
  });

  const recipientCount = countQuery.data?.data?.count ?? null;
  const matchedCustomers = previewQuery.data?.data ?? [];

  const handleFiltersChange = useCallback((updated: BroadcastFilters) => {
    setFilters(updated);
  }, []);

  const handleChannelChange = (next: ComposerChannel) => {
    setChannel(next);
    setShowConfirm(false);
  };

  const handleSendClick = () => {
    setShowConfirm(true);
  };

  const handleConfirmSend = async () => {
    setShowConfirm(false);
    setIsSending(true);

    try {
      const body: Record<string, unknown> = { channel };

      const apiFilters: Record<string, unknown> = {};
      if (filters.tags.trim()) apiFilters.tags = filters.tags.trim();
      if (filters.gender && filters.gender !== 'ALL') apiFilters.gender = filters.gender;
      if (filters.minSpend) apiFilters.minSpend = parseFloat(filters.minSpend);
      if (filters.maxSpend) apiFilters.maxSpend = parseFloat(filters.maxSpend);
      if (filters.birthdayMonth && filters.birthdayMonth !== '0') {
        apiFilters.birthdayMonth = parseInt(filters.birthdayMonth, 10);
      }
      if (Object.keys(apiFilters).length > 0) body.filters = apiFilters;

      if (isEmail) {
        body.subject = subject.trim();
        body.html = html;
        if (message.trim()) body.message = message;
        if (imageUrls.length > 0) body.imageUrls = imageUrls;
      } else {
        body.message = message;
      }

      const res = await fetch('/api/broadcast/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      const json = await res.json();

      if (!res.ok) {
        toast.error(json?.error?.message ?? 'Failed to send broadcast');
        return;
      }

      const { total, status, providerConfigured } = json.data as {
        total: number;
        status?: string;
        broadcastId?: string;
        providerConfigured?: boolean;
      };

      if (providerConfigured === false) {
        toast.warning(
          `${isEmail ? 'Email' : 'SMS'} is not configured, so deliveries will fail. Queued for ${total} customer${total !== 1 ? 's' : ''}; configure the provider and resend.`,
        );
      } else if (status === 'SENDING') {
        toast.success(
          `${isEmail ? 'Email' : 'SMS'} broadcast queued for ${total} customer${total !== 1 ? 's' : ''}. Delivery continues in the background — check Broadcast History for the result.`,
        );
      } else {
        toast.success(`Broadcast started for ${total} customer${total !== 1 ? 's' : ''}.`);
      }

      router.push('/customers/broadcast/history');
    } catch {
      toast.error('An unexpected error occurred');
    } finally {
      setIsSending(false);
    }
  };

  const confirmPreviewHtml = buildEmailHtml({
    html,
    text: message,
    customerName: 'Nimal',
    storeName: 'Your Store',
    images: imageUrls,
  });

  return (
    <div className="space-y-6 p-6 md:p-8">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link href="/customers">
          <Button variant="ghost" size="icon" className="text-espresso" aria-label="Back to customers">
            <ArrowLeft className="h-5 w-5" />
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-display font-bold text-espresso">
            Marketing Broadcast
          </h1>
          <p className="text-sm text-sand-ink mt-0.5">
            Send targeted Email or SMS campaigns to your customers
          </p>
        </div>
        <div className="ml-auto">
          <Button variant="outline" asChild>
            <Link href="/customers/broadcast/history">View Delivery Analytics</Link>
          </Button>
        </div>
      </div>

      {/* Two-column grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left: Filters */}
        <Card className="border-mist">
          <CardHeader className="pb-3">
            <CardTitle className="text-base text-espresso">Target Audience</CardTitle>
          </CardHeader>
          <CardContent>
            <BroadcastFilterPanel filters={filters} onChange={handleFiltersChange} />
          </CardContent>
        </Card>

        {/* Right: Composer */}
        <Card className="border-mist">
          <CardHeader className="pb-3">
            <CardTitle className="text-base text-espresso">Message</CardTitle>
          </CardHeader>
          <CardContent>
            <BroadcastComposer
              channel={channel}
              onChannelChange={handleChannelChange}
              subject={subject}
              onSubjectChange={setSubject}
              message={message}
              onMessageChange={setMessage}
              html={html}
              onHtmlChange={setHtml}
              imageUrls={imageUrls}
              onImageUrlsChange={setImageUrls}
              recipientCount={recipientCount}
              isSending={isSending}
              onSend={handleSendClick}
            />
          </CardContent>
        </Card>
      </div>

      {/* Count preview callout */}
      <div className="rounded-lg border border-mist bg-linen px-5 py-4 flex items-center gap-3">
        <Users className="h-5 w-5 text-terracotta shrink-0" />
        <div>
          {countQuery.isLoading ? (
            <p className="text-sm text-sand-ink">Counting matching customers…</p>
          ) : recipientCount !== null ? (
            <p className="text-sm text-espresso">
              <span className="font-bold text-terracotta">{recipientCount}</span>{' '}
              customer{recipientCount !== 1 ? 's' : ''} match your filters and have a{' '}
              {isEmail ? 'valid email address' : 'phone number'}
            </p>
          ) : (
            <p className="text-sm text-sand-ink">No count available</p>
          )}
        </div>
      </div>

      {/* Matching customers table */}
      {matchedCustomers.length > 0 && (
        <Card className="border-mist">
          <CardHeader className="pb-3">
            <CardTitle className="text-base text-espresso">
              Matching Customers ({matchedCustomers.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-mist bg-pearl">
                    <th className="px-4 py-3 text-left font-medium text-sand-ink">Name</th>
                    <th className="px-4 py-3 text-left font-medium text-sand-ink">
                      {isEmail ? 'Email' : 'Phone'}
                    </th>
                    <th className="px-4 py-3 text-left font-medium text-sand-ink">Tags</th>
                    <th className="px-4 py-3 text-right font-medium text-sand-ink">Total Spend</th>
                    <th className="px-4 py-3 text-center font-medium text-sand-ink">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {matchedCustomers.map((c, idx) => (
                    <tr
                      key={c.id}
                      className={idx % 2 === 0 ? 'bg-white' : 'bg-pearl/50'}
                    >
                      <td className="px-4 py-3 font-medium text-espresso">{c.name}</td>
                      <td className="px-4 py-3 text-sand-ink font-mono text-xs">
                        {(isEmail ? c.email : c.phone) ?? '—'}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-1">
                          {c.tags.length > 0 ? (
                            c.tags.map((tag) => (
                              <Badge key={tag} variant="secondary" className="text-xs">
                                {tag}
                              </Badge>
                            ))
                          ) : (
                            <span className="text-mist-ink text-xs">—</span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right text-espresso tabular-nums">
                        Rs {parseFloat(c.totalSpend).toLocaleString('en-LK', { minimumFractionDigits: 2 })}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <Button variant="ghost" size="sm" asChild>
                          <Link href={`/customers/${c.id}`}>
                            <Eye className="h-4 w-4 mr-1" />
                            View
                          </Link>
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Confirmation Dialog */}
      <Dialog open={showConfirm} onOpenChange={setShowConfirm}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Confirm {isEmail ? 'Email' : 'SMS'} Broadcast</DialogTitle>
            <DialogDescription>
              You are about to send an {isEmail ? 'email' : 'SMS'} to{' '}
              <span className="font-bold text-espresso">{recipientCount}</span>{' '}
              customer{recipientCount !== 1 ? 's' : ''}. This action cannot be undone.
            </DialogDescription>
          </DialogHeader>

          {isEmail ? (
            <div className="space-y-2">
              <p className="text-xs uppercase tracking-wide text-sand-ink">Subject</p>
              <p className="text-sm font-medium text-espresso">{subject}</p>
              <p className="text-xs uppercase tracking-wide text-sand-ink">Preview</p>
              <iframe
                title="Email broadcast preview"
                srcDoc={confirmPreviewHtml}
                sandbox=""
                className="h-[300px] w-full rounded-lg border border-mist bg-white"
              />
            </div>
          ) : (
            <div className="max-h-52 overflow-y-auto whitespace-pre-wrap rounded-lg border border-mist bg-linen p-3 font-mono text-sm text-espresso">
              {message}
            </div>
          )}

          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setShowConfirm(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleConfirmSend}
              className="bg-terracotta hover:bg-terracotta/90 text-pearl"
            >
              Send Now
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
