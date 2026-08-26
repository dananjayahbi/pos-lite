'use client';

import { CalendarView } from '@/components/appointments/calendar/CalendarView';
import { AppointmentFormDialog } from '@/components/appointments/form/AppointmentFormDialog';
import { AppointmentDetailPanel } from '@/components/appointments/detail/AppointmentDetailPanel';
import { AppointmentsLayout } from '@/components/appointments/AppointmentsLayout';
import { useAppointmentStore } from '@/stores/appointmentStore';

export function AppointmentsPageClient() {
  const isFormOpen = useAppointmentStore((s) => s.isFormOpen);
  const isDetailOpen = useAppointmentStore((s) => s.isDetailOpen);
  const selectedAppointmentId = useAppointmentStore((s) => s.selectedAppointmentId);
  const editingAppointmentId = useAppointmentStore((s) => s.editingAppointmentId);
  const closeForm = useAppointmentStore((s) => s.closeForm);
  const closeDetail = useAppointmentStore((s) => s.closeDetail);
  const openCreateForm = useAppointmentStore((s) => s.openCreateForm);
  const openEditForm = useAppointmentStore((s) => s.openEditForm);
  const openDetail = useAppointmentStore((s) => s.openDetail);
  const currentDate = useAppointmentStore((s) => s.currentDate);

  return (
    <AppointmentsLayout>
      <CalendarView
        onAppointmentClick={(id) => openDetail(id)}
        onSlotClick={(date) => {
          // Pre-fill the form with the clicked slot time
          const end = new Date(date);
          end.setMinutes(end.getMinutes() + 30);
          openCreateForm();
        }}
      />

      <AppointmentFormDialog
        open={isFormOpen}
        onClose={closeForm}
        editingId={editingAppointmentId}
        defaultDate={currentDate}
      />

      <AppointmentDetailPanel
        appointmentId={selectedAppointmentId}
        open={isDetailOpen}
        onClose={closeDetail}
      />
    </AppointmentsLayout>
  );
}
