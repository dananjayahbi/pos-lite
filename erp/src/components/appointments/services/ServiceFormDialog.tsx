'use client';

import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { AppointmentServiceSchema } from '@/lib/validators/appointment.validators';
import { toServicePrice, type AppointmentServiceRecord } from '@/lib/appointments/service-catalog';

interface ServiceFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Existing service to edit, or null to create a new one. */
  service: AppointmentServiceRecord | null;
}

/** Brand palette first, then a few distinct shift colours for the calendar. */
const COLOR_SWATCHES = [
  '#3A2D28',
  '#A48374',
  '#CBAD8D',
  '#3B82F6',
  '#8B5CF6',
  '#EC4899',
  '#22C55E',
  '#F59E0B',
];

const DURATION_PRESETS = [15, 30, 45, 60, 90];

/** Backend domain errors arrive as codes for POST and sentences for PATCH. */
function friendlyServiceError(message: string): string {
  if (message.includes('SERVICE_NAME_EXISTS')) {
    return 'A service with this name already exists.';
  }
  if (message.includes('SERVICE_NOT_FOUND')) {
    return 'This service no longer exists. Refresh the page and try again.';
  }
  return message;
}

export function ServiceFormDialog({ open, onOpenChange, service }: ServiceFormDialogProps) {
  const isEdit = service !== null;

  // Key the form by service + open so the fields reset on every reopen without
  // a setState-in-effect (same pattern as BrandEditDialog).
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <ServiceForm
          key={`${service?.id ?? 'new'}-${open}`}
          service={service}
          isEdit={isEdit}
          onOpenChange={onOpenChange}
        />
      </DialogContent>
    </Dialog>
  );
}

function ServiceForm({
  service,
  isEdit,
  onOpenChange,
}: {
  service: AppointmentServiceRecord | null;
  isEdit: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const queryClient = useQueryClient();
  const [name, setName] = useState(service?.name ?? '');
  const [description, setDescription] = useState(service?.description ?? '');
  const [durationMins, setDurationMins] = useState(
    service ? String(service.durationMins) : '30',
  );
  const [price, setPrice] = useState(
    service ? String(toServicePrice(service.price)) : '',
  );
  const [color, setColor] = useState(service?.color ?? COLOR_SWATCHES[1] ?? '#A48374');
  const [isActive, setIsActive] = useState(service?.isActive ?? true);
  const [sortOrder, setSortOrder] = useState(String(service?.sortOrder ?? 0));
  const [formError, setFormError] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: async () => {
      const candidate = {
        name: name.trim(),
        description: description.trim() ? description.trim() : null,
        durationMins: Number(durationMins),
        price: Number(price === '' ? 0 : price),
        color: color || null,
        isActive,
        sortOrder: Number(sortOrder === '' ? 0 : sortOrder),
      };

      const parsed = AppointmentServiceSchema.safeParse(candidate);
      if (!parsed.success) {
        throw new Error(parsed.error.issues[0]?.message ?? 'Please check the form');
      }

      const url = isEdit
        ? `/api/store/appointments/services/${service!.id}`
        : '/api/store/appointments/services';
      const res = await fetch(url, {
        method: isEdit ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(parsed.data),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.success) {
        throw new Error(json?.error?.message ?? 'Failed to save the service');
      }
      return json.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['appointment-services'] });
      if (service) {
        queryClient.invalidateQueries({ queryKey: ['appointment-service', service.id] });
      }
      toast.success(isEdit ? 'Service updated' : 'Service created');
      onOpenChange(false);
    },
    onError: (error: Error) => {
      setFormError(friendlyServiceError(error.message));
    },
  });

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    setFormError(null);
    mutation.mutate();
  };

  return (
    <>
      <DialogHeader>
        <DialogTitle className="font-display text-xl text-espresso">
          {isEdit ? 'Edit service' : 'New service'}
        </DialogTitle>
        <DialogDescription className="font-body text-sm text-mist-ink">
          {isEdit
            ? 'Update the details shown to staff when booking this service.'
            : 'Add a bookable service to the appointment catalogue.'}
        </DialogDescription>
      </DialogHeader>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="service-name">Service name</Label>
          <Input
            id="service-name"
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="e.g. Initial consultation"
            maxLength={100}
            required
            autoFocus
          />
        </div>

        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <Label htmlFor="service-description">Description</Label>
            <span className="text-xs text-mist-ink">{description.length}/500</span>
          </div>
          <Textarea
            id="service-description"
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            placeholder="A short note shown on the booking form"
            rows={3}
            maxLength={500}
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="service-duration">Duration (minutes)</Label>
            <Input
              id="service-duration"
              type="number"
              min={5}
              max={480}
              step={1}
              value={durationMins}
              onChange={(event) => setDurationMins(event.target.value)}
              required
            />
            <div className="flex flex-wrap gap-1.5">
              {DURATION_PRESETS.map((preset) => (
                <button
                  key={preset}
                  type="button"
                  onClick={() => setDurationMins(String(preset))}
                  className={`rounded-full border px-2 py-0.5 text-xs transition-colors ${
                    durationMins === String(preset)
                      ? 'border-terracotta bg-terracotta/10 text-espresso'
                      : 'border-mist text-mist-ink hover:border-sand hover:text-espresso'
                  }`}
                >
                  {preset} min
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="service-price">Price (LKR)</Label>
            <div className="relative">
              <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-sm text-mist-ink">
                Rs.
              </span>
              <Input
                id="service-price"
                type="number"
                min={0}
                step="0.01"
                inputMode="decimal"
                className="pl-10"
                value={price}
                onChange={(event) => setPrice(event.target.value)}
                placeholder="0.00"
                required
              />
            </div>
            <p className="text-xs text-mist-ink">Charged when the appointment converts to a sale.</p>
          </div>
        </div>

        <div className="space-y-2">
          <Label>Calendar colour</Label>
          <div className="flex flex-wrap items-center gap-2">
            {COLOR_SWATCHES.map((swatch) => {
              const selected = color.toLowerCase() === swatch.toLowerCase();
              return (
                <button
                  key={swatch}
                  type="button"
                  aria-label={`Use colour ${swatch}`}
                  aria-pressed={selected}
                  onClick={() => setColor(swatch)}
                  className={`h-8 w-8 rounded-full border-2 transition-transform ${
                    selected ? 'scale-110 border-espresso' : 'border-transparent hover:scale-105'
                  }`}
                  style={{ backgroundColor: swatch }}
                />
              );
            })}
            <label className="ml-1 inline-flex cursor-pointer items-center gap-2 text-xs text-mist-ink">
              <input
                type="color"
                aria-label="Custom calendar colour"
                value={/^#[0-9a-fA-F]{6}$/.test(color) ? color : '#A48374'}
                onChange={(event) => setColor(event.target.value)}
                className="h-8 w-8 cursor-pointer rounded border border-mist bg-transparent p-0.5"
              />
              Custom
            </label>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="service-sort-order">Display order</Label>
            <Input
              id="service-sort-order"
              type="number"
              min={0}
              step={1}
              value={sortOrder}
              onChange={(event) => setSortOrder(event.target.value)}
            />
            <p className="text-xs text-mist-ink">Lower numbers appear first.</p>
          </div>

          <div className="flex items-start justify-between gap-3 rounded-lg border border-mist px-3 py-2.5">
            <div>
              <Label htmlFor="service-active" className="cursor-pointer">
                Active
              </Label>
              <p className="text-xs text-mist-ink">Inactive services stay hidden from new bookings.</p>
            </div>
            <Switch id="service-active" checked={isActive} onCheckedChange={setIsActive} />
          </div>
        </div>

        {formError ? (
          <p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {formError}
          </p>
        ) : null}

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            className="border-sand text-espresso"
            onClick={() => onOpenChange(false)}
            disabled={mutation.isPending}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            className="bg-espresso text-pearl hover:bg-espresso/90"
            disabled={mutation.isPending || !name.trim()}
          >
            {mutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            {mutation.isPending ? 'Saving…' : isEdit ? 'Save changes' : 'Create service'}
          </Button>
        </DialogFooter>
      </form>
    </>
  );
}
