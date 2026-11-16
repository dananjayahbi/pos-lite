'use client';

import { ServiceList } from '@/components/appointments/services/ServiceList';
import { AppointmentsLayout } from '@/components/appointments/AppointmentsLayout';

export function AppointmentsServicesPageClient() {
  return (
    <AppointmentsLayout>
      <ServiceList />
    </AppointmentsLayout>
  );
}
