'use client';

import { useState, useCallback } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { CustomerSelector } from './CustomerSelector';
import { ServiceSelector } from './ServiceSelector';
import { StaffSelector } from './StaffSelector';
import { NotesField } from './NotesField';

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
  notes: '',
  customerNotes: '',
};

export function AppointmentForm({ initialData, onSubmit, onCancel, isSubmitting, defaultStartDate }: AppointmentFormProps) {
  const [form, setForm] = useState<AppointmentFormData>(() => {
    const initial = {
      ...defaultFormData,
      ...((initialData ?? {}) as Partial<AppointmentFormData>),
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

  const isValid = form.startTime && form.endTime && (form.customerId || (form.walkInName && form.walkInPhone));

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
            value={form.startTime ? form.startTime.slice(0, 16) : ''}
            onChange={(e) => {
              const d = new Date(e.target.value);
              update('startTime', d.toISOString());
              const end = new Date(d);
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

      <div className="space-y-1.5">
        <Label className="text-sm font-medium">Price ($)</Label>
        <Input
          type="number"
          min={0}
          step={0.01}
          value={form.price}
          onChange={(e) => update('price', parseFloat(e.target.value) || 0)}
        />
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
