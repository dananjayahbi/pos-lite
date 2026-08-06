'use client';

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { useAppointmentServices } from '@/hooks/appointments';

interface ServiceSelectorProps {
  value: string | null;
  onChange: (serviceId: string | null, durationMins?: number, price?: number) => void;
}

export function ServiceSelector({ value, onChange }: ServiceSelectorProps) {
  const { data: services = [] } = useAppointmentServices();
  const activeServices = (services as Array<{ id: string; name: string; durationMins: number; price: number; isActive: boolean }>).filter((s) => s.isActive);

  return (
    <div className="space-y-1.5">
      <Label className="text-sm font-medium">Service (optional)</Label>
      <Select
        value={value ?? ''}
        onValueChange={(v) => {
          const svc = activeServices.find((s) => s.id === v);
          onChange(v || null, svc?.durationMins, svc ? Number(svc.price) : undefined);
        }}
      >
        <SelectTrigger>
          <SelectValue placeholder="Select a service" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="">No service</SelectItem>
          {activeServices.map((s) => (
            <SelectItem key={s.id} value={s.id}>
              {s.name} — {s.durationMins}min — ${Number(s.price).toFixed(2)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
