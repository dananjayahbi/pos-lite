'use client';

import { useState } from 'react';
import { ServiceList } from '@/components/appointments/services/ServiceList';
import { ServiceFormDialog } from '@/components/appointments/services/ServiceFormDialog';
import { AppointmentsLayout } from '@/components/appointments/AppointmentsLayout';

export function AppointmentsServicesPageClient() {
  const [editId, setEditId] = useState<string | null>(null);
  const [isOpen, setIsOpen] = useState(false);

  return (
    <AppointmentsLayout>
      <ServiceList />
    </AppointmentsLayout>
  );
}
