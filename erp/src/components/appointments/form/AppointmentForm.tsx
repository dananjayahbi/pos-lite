'use client';

import { useState, useCallback } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { CustomerSelector } from './CustomerSelector';
import { ServiceSelector } from './ServiceSelector';
import { StaffSelector } from './StaffSelector';
import { NotesField } from './NotesField';
import { fromDatetimeLocalValue, toDatetimeLocalValue } from '@/lib/appointments/datetime-local';

interface AppointmentFormData {
  title: string;
  startTime: string;
  endTime: string;
  customerId: string | null;
  walkInName: string;
  walkInPhone: string;
  serviceId: string | null;
  staffId: string | null;
  durationMins: number;
  price: number;
  /** Money already taken at booking; ARGUS #121 surfaced the field. */
  depositAmount: number;
  notes: string;
  customerNotes: string;
}

interface AppointmentFormProps {
  initialData?: Partial<Record<string, unknown>> | undefined;
  onSubmit: (data: Record<string, unknown>) => void;
  onCancel: () => void;
  isSubmitting?: boolean | undefined;
  defaultStartDate?: Date | null | undefined;
}

const defaultFormData: AppointmentFormData = {
  title: '',
  startTime: '',
  endTime: '',
  customerId: null,
  walkInName: '',
  walkInPhone: '',
  serviceId: null,
  staffId: null,
  durationMins: 30,
  price: 0,
  depositAmount: 0,
  notes: '',
  customerNotes: '',
};

export function AppointmentForm({ initialData, onSubmit, onCancel, isSubmitting, defaultStartDate }: AppointmentFormProps) {
  const [form, setForm] = useState<AppointmentFormData>(() => {
    const merged = {
      ...defaultFormData,
      ...((initialData ?? {}) as Partial<AppointmentFormData>),
    };
    // Prisma Decimals arrive as strings through the API; the money and duration
    // inputs are numeric so coerce once here.
    const initial: AppointmentFormData = {
      ...merged,
      durationMins: Number(merged.durationMins) || defaultFormData.durationMins,
      price: Number(merged.price) || 0,
      depositAmount: Number(merged.depositAmount) || 0,
    };
    if (defaultStartDate && !initial.startTime) {
      initial.startTime = defaultStartDate.toISOString();
      const end = new Date(defaultStartDate);
      end.setMinutes(end.getMinutes() + (initial.durationMins || 30));
      initial.endTime = end.toISOString();
    }
    return initial;
  });

  const update = useCallback(<K extends keyof AppointmentFormData>(key: K, value: AppointmentFormData[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  }, []);

  const handleServiceChange = (serviceId: string | null, durationMins?: number, price?: number) => {
    setForm((prev) => {
      const next = { ...prev, serviceId };
      if (durationMins !== undefined) {
        next.durationMins = durationMins;
        if (prev.startTime) {
          const start = new Date(prev.startTime);
          start.setMinutes(start.getMinutes() + durationMins);
          next.endTime = start.toISOString();
        }
      }
      if (price !== undefined) next.price = price;
      return next;
    });
  };

  const handleCustomerChange = (customerId: string | null) => {
    update('customerId', customerId);
    if (customerId) {
      update('walkInName', '');
      update('walkInPhone', '');
    }
  };

  const depositError =
    form.depositAmount < 0
      ? 'Deposit cannot be negative'
      : form.depositAmount > form.price
        ? 'Deposit cannot exceed the price'
        : null;

  const isValid =
    !depositError &&
    form.startTime &&
    form.endTime &&
    (form.customerId || (form.walkInName && form.walkInPhone));

  return (
    <div className="space-y-4">
      <CustomerSelector
        value={form.customerId}
        onChange={handleCustomerChange}
        onWalkInChange={(name, phone) => { update('walkInName', name); update('walkInPhone', phone); }}
        walkInName={form.walkInName}
        walkInPhone={form.walkInPhone}
      />

      <ServiceSelector value={form.serviceId} onChange={handleServiceChange} />

      <StaffSelector value={form.staffId} onChange={(v) => update('staffId', v)} />

      <div className="space-y-1.5">
        <Label className="text-sm font-medium">Title</Label>
        <Input
          value={form.title}
          onChange={(e) => update('title', e.target.value)}
          placeholder="e.g., Ayurvedic Consultation"
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label className="text-sm font-medium">Start Time</Label>
          <Input
            type="datetime-local"
            value={toDatetimeLocalValue(form.startTime)}
            onChange={(e) => {
              const startIso = fromDatetimeLocalValue(e.target.value);
              update('startTime', startIso);
              if (!startIso) {
                update('endTime', '');
                return;
              }
              const end = new Date(startIso);
              end.setMinutes(end.getMinutes() + form.durationMins);
              update('endTime', end.toISOString());
            }}
          />
        </div>
        <div className="space-y-1.5">
          <Label className="text-sm font-medium">Duration (mins)</Label>
          <Input
            type="number"
            min={5}
            max={480}
            value={form.durationMins}
            onChange={(e) => {
              const mins = parseInt(e.target.value) || 30;
              update('durationMins', mins);
              if (form.startTime) {
                const start = new Date(form.startTime);
                start.setMinutes(start.getMinutes() + mins);
                update('endTime', start.toISOString());
              }
            }}
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label className="text-sm font-medium">Price (LKR)</Label>
          <div className="relative">
            <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-sm text-mist-ink">
              Rs.
            </span>
            <Input
              type="number"
              min={0}
              step={0.01}
              className="pl-10"
              value={form.price}
              onChange={(e) => update('price', parseFloat(e.target.value) || 0)}
            />
          </div>
        </div>
        <div className="space-y-1.5">
          <Label className="text-sm font-medium">Deposit Amount (LKR)</Label>
          <div className="relative">
            <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-sm text-mist-ink">
              Rs.
            </span>
            <Input
              type="number"
              min={0}
              step={0.01}
              className="pl-10"
              value={form.depositAmount}
              aria-invalid={depositError ? true : undefined}
              onChange={(e) => update('depositAmount', parseFloat(e.target.value) || 0)}
            />
          </div>
          {depositError ? (
            <p role="alert" className="text-xs text-red-600">
              {depositError}
            </p>
          ) : (
            <p className="text-xs text-espresso/60">Collected at booking; the balance is due on completion.</p>
          )}
        </div>
      </div>

      <NotesField
        notes={form.notes}
        customerNotes={form.customerNotes}
        onNotesChange={(v) => update('notes', v)}
        onCustomerNotesChange={(v) => update('customerNotes', v)}
      />

      <div className="flex justify-end gap-2 pt-2">
        <Button type="button" variant="outline" onClick={onCancel} disabled={isSubmitting}>
          Cancel
        </Button>
        <Button type="button" onClick={() => onSubmit(form as unknown as Record<string, unknown>)} disabled={!isValid || isSubmitting}>
          {isSubmitting ? 'Saving...' : 'Save Appointment'}
        </Button>
      </div>
    </div>
  );
}
