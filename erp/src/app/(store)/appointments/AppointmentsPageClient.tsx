'use client';

import { CalendarView } from '@/components/appointments/calendar/CalendarView';
import { AppointmentFormDialog } from '@/components/appointments/form/AppointmentFormDialog';
import { AppointmentDetailPanel } from '@/components/appointments/detail/AppointmentDetailPanel';
import { AppointmentsLayout } from '@/components/appointments/AppointmentsLayout';
import { AppointmentSummaryCards } from '@/components/appointments/stats/AppointmentSummaryCards';
import { useAppointmentStore } from '@/stores/appointmentStore';
import { appointmentSlotDefaults } from '@/lib/appointments/appointmentCalendar.core';

export function AppointmentsPageClient() {
  const isFormOpen = useAppointmentStore((s) => s.isFormOpen);
  const isDetailOpen = useAppointmentStore((s) => s.isDetailOpen);
  const selectedAppointmentId = useAppointmentStore((s) => s.selectedAppointmentId);
  const editingAppointmentId = useAppointmentStore((s) => s.editingAppointmentId);
  const formInitialData = useAppointmentStore((s) => s.formInitialData);
  const closeForm = useAppointmentStore((s) => s.closeForm);
  const closeDetail = useAppointmentStore((s) => s.closeDetail);
  const openCreateForm = useAppointmentStore((s) => s.openCreateForm);
  const openEditForm = useAppointmentStore((s) => s.openEditForm);
  const openDetail = useAppointmentStore((s) => s.openDetail);
  const currentDate = useAppointmentStore((s) => s.currentDate);

  return (
    <AppointmentsLayout>
      <AppointmentSummaryCards />
      <CalendarView
        onAppointmentClick={(id) => openDetail(id)}
        onNewClick={() => openCreateForm()}
        onSlotClick={(date) => {
          // ARGUS #133: prefill the form with the clicked slot, not "now".
          openCreateForm(appointmentSlotDefaults(date));
        }}
      />

      <AppointmentFormDialog
        open={isFormOpen}
        onClose={closeForm}
        editingId={editingAppointmentId}
        defaultDate={currentDate}
        initialData={formInitialData ?? undefined}
      />

      <AppointmentDetailPanel
        appointmentId={selectedAppointmentId}
        open={isDetailOpen}
        onClose={closeDetail}
      />
    </AppointmentsLayout>
  );
}
