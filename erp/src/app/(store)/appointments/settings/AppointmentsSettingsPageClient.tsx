'use client';

import { AppointmentsLayout } from '@/components/appointments/AppointmentsLayout';
import { AppointmentSettingsForm } from '@/components/appointments/settings/AppointmentSettingsForm';
import { StaffAvailabilityManager } from '@/components/appointments/availability/StaffAvailabilityManager';

export function AppointmentsSettingsPageClient() {
  return (
    <AppointmentsLayout>
      <div className="space-y-8">
        <AppointmentSettingsForm />
        <StaffAvailabilityManager />
      </div>
    </AppointmentsLayout>
  );
}
