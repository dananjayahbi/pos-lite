'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { z } from 'zod';
import { standardSchemaResolver } from '@hookform/resolvers/standard-schema';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

// ── Types ────────────────────────────────────────────────────────────────────

const KNOWN_EVENTS = [
  'sale.completed',
  'return.initiated',
  'stock.adjusted',
  'stock.low',
  'customer.created',
] as const;

type KnownEvent = typeof KNOWN_EVENTS[number];

interface WebhookEndpoint {
  id: string;
  url: string;
  isActive: boolean;
  events: string[];
  createdAt: string;
  lastDelivery: {
    status: string;
    statusCode: number | null;
    attemptedAt: string;
  } | null;
}

interface CreateEndpointResponse {
  id: string;
  url: string;
  secret: string;
  isActive: boolean;
  events: string[];
  createdAt: string;
}

// ── Form Schema ──────────────────────────────────────────────────────────────

const addWebhookSchema = z.object({
  url: z.string().url('Must be a valid URL').refine((u) => u.startsWith('https://'), {
    message: 'Webhook URL must use HTTPS',
  }),
  events: z
    .array(z.enum(KNOWN_EVENTS))
    .min(1, 'Select at least one event'),
});

type AddWebhookForm = z.infer<typeof addWebhookSchema>;

// ── Component ────────────────────────────────────────────────────────────────

export default function WebhooksPageClient() {
  const queryClient = useQueryClient();
  const [showAddForm, setShowAddForm] = useState(false);
  const [secretDialog, setSecretDialog] = useState<{ open: boolean; secret: string }>({
    open: false,
    secret: '',
  });

  const { data: endpoints = [], isLoading } = useQuery<WebhookEndpoint[]>({
    queryKey: ['webhook-endpoints'],
    queryFn: async () => {
      const res = await fetch('/api/webhooks/endpoints');
      const json: unknown = await res.json();
      const body = json as { success: boolean; data?: WebhookEndpoint[]; error?: { message: string } };
      if (!body.success) throw new Error(body.error?.message ?? 'Failed to fetch');
      return body.data ?? [];
    },
    staleTime: 30_000,
  });

  const form = useForm<AddWebhookForm>({
    resolver: standardSchemaResolver(addWebhookSchema),
    defaultValues: { url: '', events: [] },
  });

  const createMutation = useMutation({
    mutationFn: async (data: AddWebhookForm) => {
      const res = await fetch('/api/webhooks/endpoints', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      const json: unknown = await res.json();
      const body = json as { success: boolean; data?: CreateEndpointResponse; error?: { message: string } };
      if (!body.success) throw new Error(body.error?.message ?? 'Failed to create');
      return body.data!;
    },
    onSuccess: (data) => {
      void queryClient.invalidateQueries({ queryKey: ['webhook-endpoints'] });
      form.reset();
      setShowAddForm(false);
      setSecretDialog({ open: true, secret: data.secret });
    },
    onError: (err: Error) => {
      toast.error(err.message);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (endpointId: string) => {
      const res = await fetch(`/api/webhooks/endpoints/${endpointId}`, { method: 'DELETE' });
      const json: unknown = await res.json();
      const body = json as { success: boolean; error?: { message: string } };
      if (!body.success) throw new Error(body.error?.message ?? 'Failed to delete');
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['webhook-endpoints'] });
      toast.success('Webhook endpoint deleted');
    },
    onError: (err: Error) => {
      toast.error(err.message);
    },
  });

  const testMutation = useMutation({
    mutationFn: async (endpointId: string) => {
      const res = await fetch(`/api/webhooks/endpoints/${endpointId}/test`, { method: 'POST' });
      const json: unknown = await res.json();
      const body = json as { success: boolean; data?: { status: string }; error?: { message: string } };
      if (!body.success) throw new Error(body.error?.message ?? 'Test failed');
      return body.data!;
    },
    onSuccess: (data) => {
      void queryClient.invalidateQueries({ queryKey: ['webhook-endpoints'] });
      if (data.status === 'SUCCESS') {
        toast.success('Test webhook delivered successfully');
      } else {
        toast.error('Test webhook delivery failed');
      }
    },
    onError: (err: Error) => {
      toast.error(err.message);
    },
  });

  const selectedEvents = form.watch('events');

  function toggleEvent(event: KnownEvent) {
    const current = form.getValues('events');
    if (current.includes(event)) {
      form.setValue(
        'events',
        current.filter((e) => e !== event),
        { shouldValidate: true },
      );
    } else {
      form.setValue('events', [...current, event], { shouldValidate: true });
    }
  }

  function copyToClipboard(text: string) {
    void navigator.clipboard.writeText(text);
    toast.success('Copied to clipboard');
  }

  return (
    <div className="mx-auto w-full max-w-4xl space-y-6 p-6">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-2xl font-bold text-espresso">Webhooks</h1>
        <Button
          onClick={() => setShowAddForm(!showAddForm)}
          className="bg-espresso text-pearl hover:bg-espresso/90"
        >
          {showAddForm ? 'Cancel' : 'Add Webhook'}
        </Button>
      </div>

      {/* Add Webhook Form */}
      {showAddForm && (
        <Card className="border-mist">
          <CardHeader>
            <CardTitle className="text-lg text-espresso">New Webhook Endpoint</CardTitle>
          </CardHeader>
          <CardContent>
            <form
              onSubmit={form.handleSubmit((data) => createMutation.mutate(data))}
              className="space-y-4"
            >
              <div className="space-y-2">
                <Label htmlFor="webhook-url" className="text-espresso">
                  Endpoint URL
                </Label>
                <Input
                  id="webhook-url"
                  placeholder="https://example.com/webhook"
                  {...form.register('url')}
                  className="border-mist"
                />
                {form.formState.errors.url && (
                  <p className="text-sm text-terracotta">{form.formState.errors.url.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label className="text-espresso">Events</Label>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                  {KNOWN_EVENTS.map((event) => (
                    <label
                      key={event}
                      className="flex cursor-pointer items-center gap-2 rounded-md border border-mist p-2 text-sm hover:bg-linen"
                    >
                      <Checkbox
                        checked={selectedEvents.includes(event)}
                        onCheckedChange={() => toggleEvent(event)}
                      />
                      <span className="font-mono text-xs text-espresso">{event}</span>
                    </label>
                  ))}
                </div>
                {form.formState.errors.events && (
                  <p className="text-sm text-terracotta">
                    {form.formState.errors.events.message}
                  </p>
                )}
              </div>

              <Button
                type="submit"
                disabled={createMutation.isPending}
                className="bg-espresso text-pearl hover:bg-espresso/90"
              >
                {createMutation.isPending ? 'Creating…' : 'Create Endpoint'}
              </Button>
            </form>
          </CardContent>
        </Card>
      )}

      {/* Endpoints Table */}
      <Card className="border-mist">
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex items-center justify-center p-8 text-sand">Loading…</div>
          ) : endpoints.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-2 p-8 text-sand">
              <p>No webhook endpoints configured.</p>
              <p className="text-sm">Click &quot;Add Webhook&quot; to get started.</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-espresso">URL</TableHead>
                  <TableHead className="text-espresso">Events</TableHead>
                  <TableHead className="text-espresso">Status</TableHead>
                  <TableHead className="text-espresso">Last Delivery</TableHead>
                  <TableHead className="text-right text-espresso">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {endpoints.map((ep) => (
                  <TableRow key={ep.id}>
                    <TableCell className="max-w-[200px] truncate font-mono text-xs text-espresso">
                      {ep.url}
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {ep.events.map((ev) => (
                          <Badge
                            key={ev}
                            variant="outline"
                            className="border-mist font-mono text-[10px] text-sand"
                          >
                            {ev}
                          </Badge>
                        ))}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge
                        className={
                          ep.isActive
                            ? 'bg-espresso text-pearl'
                            : 'bg-mist text-sand'
                        }
                      >
                        {ep.isActive ? 'Active' : 'Inactive'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs text-sand">
                      {ep.lastDelivery ? (
                        <span>
                          <Badge
                            variant="outline"
                            className={
                              ep.lastDelivery.status === 'SUCCESS'
                                ? 'border-espresso text-espresso'
                                : 'border-terracotta text-terracotta'
                            }
                          >
                            {ep.lastDelivery.status}
                          </Badge>
                          <span className="ml-1">
                            {new Date(ep.lastDelivery.attemptedAt).toLocaleString()}
                          </span>
                        </span>
                      ) : (
                        'Never'
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => testMutation.mutate(ep.id)}
                          disabled={testMutation.isPending}
                          className="border-mist text-espresso hover:bg-linen"
                        >
                          Test
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => deleteMutation.mutate(ep.id)}
                          disabled={deleteMutation.isPending}
                          className="border-terracotta text-terracotta hover:bg-terracotta/10"
                        >
                          Delete
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Secret Dialog */}
      <Dialog
        open={secretDialog.open}
        onOpenChange={(open) => setSecretDialog((prev) => ({ ...prev, open }))}
      >
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-espresso">Webhook Secret Created</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-sand">
              This is the only time the secret will be shown. Copy it now and store it securely.
              Use it to verify webhook signatures using HMAC-SHA256.
            </p>
            <div className="flex items-center gap-2 rounded-md border border-mist bg-linen p-3">
              <code className="flex-1 break-all font-mono text-sm text-espresso">
                {secretDialog.secret}
              </code>
              <Button
                variant="outline"
                size="sm"
                onClick={() => copyToClipboard(secretDialog.secret)}
                className="shrink-0 border-mist text-espresso"
              >
                Copy
              </Button>
            </div>
            <p className="text-xs font-semibold text-terracotta">
              ⚠ This secret will not be shown again. If you lose it, delete this endpoint and
              create a new one.
            </p>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
