'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Send, Users } from 'lucide-react';

type FilterMode = 'all' | 'tag' | 'spend' | 'birthday';

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

export default function BroadcastPage() {
  const router = useRouter();

  const [message, setMessage] = useState('');
  const [filterMode, setFilterMode] = useState<FilterMode>('all');
  const [tag, setTag] = useState('VIP');
  const [spendMin, setSpendMin] = useState('');
  const [birthdayMonth, setBirthdayMonth] = useState('1');
  const [previewCount, setPreviewCount] = useState<number | null>(null);
  const [sending, setSending] = useState(false);

  // Build filter query params for preview count
  const buildFilterParams = () => {
    const params = new URLSearchParams();
    params.set('limit', '1');
    if (filterMode === 'tag') params.set('tag', tag);
    if (filterMode === 'spend' && spendMin) params.set('spendMin', spendMin);
    // birthdayMonth is handled client-side in the broadcast API
    return params;
  };

  const { isFetching: isCounting, refetch: fetchPreview } = useQuery<{ success: boolean; data: { total: number } }>({
    queryKey: ['broadcast-preview'],
    queryFn: async () => {
      const params = buildFilterParams();
      const res = await fetch(`/api/store/customers?${params.toString()}`);
      if (!res.ok) throw new Error('Failed to fetch preview');
      return res.json();
    },
    enabled: false,
  });

  const handlePreview = async () => {
    const result = await fetchPreview();
    if (result.data?.data) {
      setPreviewCount(result.data.data.total);
    }
  };

  const handleSend = async () => {
    if (!message.trim()) {
      toast.error('Please enter a message');
      return;
    }

    setSending(true);
    try {
      const filters: Record<string, unknown> = {};
      if (filterMode === 'tag') filters.tag = tag;
      if (filterMode === 'spend' && spendMin) filters.spendMin = Number(spendMin);
      if (filterMode === 'birthday') filters.birthdayMonth = Number(birthdayMonth);

      const res = await fetch('/api/store/customers/broadcast', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message,
          ...(Object.keys(filters).length > 0 ? { filters } : {}),
        }),
      });

      const json = await res.json();

      if (!res.ok) {
        toast.error(json?.error?.message ?? 'Failed to send broadcast');
        return;
      }

      toast.success(`Broadcast sent to ${json.data.recipientCount} customer(s)`);
      router.push('/customers');
    } catch {
      toast.error('An unexpected error occurred');
    } finally {
      setSending(false);
    }
  };

  const filterButtons: { mode: FilterMode; label: string }[] = [
    { mode: 'all', label: 'All Customers' },
    { mode: 'tag', label: 'By Tag' },
    { mode: 'spend', label: 'By Spend' },
    { mode: 'birthday', label: 'By Birthday Month' },
  ];

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-display font-bold text-espresso">Broadcast Message</h1>
        <p className="text-sm text-sand mt-1">
          Send a WhatsApp message to your customers
        </p>
      </div>

      {/* Message */}
      <div className="space-y-2">
        <Label htmlFor="broadcast-message">Message</Label>
        <Textarea
          id="broadcast-message"
          placeholder="Type your message... Use [name] to personalize with customer's first name."
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          maxLength={1000}
          rows={5}
          className="resize-none"
        />
        <p className="text-xs text-mist text-right">{message.length}/1000</p>
      </div>

      {/* Filters */}
      <div className="space-y-3">
        <Label>Filter Recipients</Label>
        <div className="flex flex-wrap gap-2">
          {filterButtons.map((fb) => (
            <button
              key={fb.mode}
              type="button"
              onClick={() => {
                setFilterMode(fb.mode);
                setPreviewCount(null);
              }}
              className={`px-3 py-1.5 rounded-lg font-body text-sm transition-colors ${
                filterMode === fb.mode
                  ? 'bg-terracotta text-pearl'
                  : 'bg-linen text-espresso hover:bg-mist/20'
              }`}
            >
              {fb.label}
            </button>
          ))}
        </div>

        {filterMode === 'tag' && (
          <Select value={tag} onValueChange={(v) => { setTag(v); setPreviewCount(null); }}>
            <SelectTrigger className="w-48">
              <SelectValue placeholder="Select tag" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="VIP">VIP</SelectItem>
              <SelectItem value="REGULAR">Regular</SelectItem>
              <SelectItem value="WHOLESALE">Wholesale</SelectItem>
              <SelectItem value="STAFF">Staff</SelectItem>
              <SelectItem value="ONLINE">Online</SelectItem>
            </SelectContent>
          </Select>
        )}

        {filterMode === 'spend' && (
          <div className="flex items-center gap-2">
            <Label htmlFor="spend-min" className="whitespace-nowrap">Min Spend (Rs.)</Label>
            <Input
              id="spend-min"
              type="number"
              min={0}
              value={spendMin}
              onChange={(e) => { setSpendMin(e.target.value); setPreviewCount(null); }}
              className="w-40"
            />
          </div>
        )}

        {filterMode === 'birthday' && (
          <Select value={birthdayMonth} onValueChange={(v) => { setBirthdayMonth(v); setPreviewCount(null); }}>
            <SelectTrigger className="w-48">
              <SelectValue placeholder="Select month" />
            </SelectTrigger>
            <SelectContent>
              {MONTHS.map((m, i) => (
                <SelectItem key={i + 1} value={String(i + 1)}>
                  {m}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>

      {/* Preview */}
      <div className="space-y-3">
        <Button variant="outline" onClick={handlePreview} disabled={isCounting}>
          <Users className="mr-2 h-4 w-4" />
          {isCounting ? 'Counting...' : 'Preview Recipients'}
        </Button>

        {previewCount !== null && (
          <div className="rounded-lg border border-mist/30 bg-linen px-4 py-3">
            <p className="font-body text-sm text-espresso">
              <span className="font-bold">{previewCount}</span> customer{previewCount !== 1 ? 's' : ''} will receive this message
            </p>
            {previewCount > 200 && (
              <p className="font-body text-xs text-terracotta mt-1">
                Maximum 200 recipients per broadcast. Please narrow your filters.
              </p>
            )}
          </div>
        )}
      </div>

      {/* Send */}
      <Button
        onClick={handleSend}
        disabled={sending || !message.trim() || previewCount === null || previewCount === 0 || previewCount > 200}
        className="w-full"
      >
        <Send className="mr-2 h-4 w-4" />
        {sending ? 'Sending...' : 'Send Broadcast'}
      </Button>
    </div>
  );
}
