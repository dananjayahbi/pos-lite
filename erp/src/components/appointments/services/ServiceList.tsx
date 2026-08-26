'use client';

import { useState } from 'react';
import { useAppointmentServices } from '@/hooks/appointments';
import { ServiceCard } from './ServiceCard';
import { ServiceFormDialog } from './ServiceFormDialog';
import { Button } from '@/components/ui/button';
import { EmptyState } from '../shared/EmptyState';
import { Scissors } from 'lucide-react';

export function ServiceList() {
  const { data: servicesData = [], isLoading } = useAppointmentServices();
  const services = servicesData as Array<{ id: string; name: string; description?: string | null | undefined; durationMins: number; price: number; color?: string | null | undefined; isActive: boolean }>;
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);

  // Note: ServiceFormDialog needs to handle create/edit via mutation hooks
  // This is a basic implementation

  if (isLoading) return <div className="py-8 text-center text-espresso/40">Loading services...</div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-espresso">Services ({services.length})</h2>
        <Button onClick={() => { setEditingId(null); setIsFormOpen(true); }}>Add Service</Button>
      </div>

      {services.length === 0 ? (
        <EmptyState
          icon={<Scissors className="h-12 w-12" />}
          title="No services yet"
          description="Add your first bookable service."
          action={<Button onClick={() => { setEditingId(null); setIsFormOpen(true); }}>Add Service</Button>}
        />
      ) : (
        <div className="space-y-2">
          {services.map((s) => (
            <ServiceCard
              key={s.id}
              id={s.id}
              name={s.name}
              description={s.description}
              durationMins={s.durationMins}
              price={Number(s.price)}
              color={s.color}
              isActive={s.isActive}
              onEdit={(id) => { setEditingId(id); setIsFormOpen(true); }}
              onDelete={(id) => {
                // Will be handled by ServiceFormDialog
              }}
            />
          ))}
        </div>
      )}

      {/* Placeholder for ServiceFormDialog — will be implemented separately */}
    </div>
  );
}
