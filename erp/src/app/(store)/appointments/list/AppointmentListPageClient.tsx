'use client';

import { AppointmentListView } from '@/components/appointments/list/AppointmentListView';
import { AppointmentFormDialog } from '@/components/appointments/form/AppointmentFormDialog';
import { AppointmentDetailPanel } from '@/components/appointments/detail/AppointmentDetailPanel';
import { AppointmentsLayout } from '@/components/appointments/AppointmentsLayout';
import { useAppointmentStore } from '@/stores/appointmentStore';

export function AppointmentListPageClient() {
  const isFormOpen = useAppointmentStore((s) => s.isFormOpen);
  const isDetailOpen = useAppointmentStore((s) => s.isDetailOpen);
  const selectedAppointmentId = useAppointmentStore((s) => s.selectedAppointmentId);
  const editingAppointmentId = useAppointmentStore((s) => s.editingAppointmentId);
  const closeForm = useAppointmentStore((s) => s.closeForm);
  const closeDetail = useAppointmentStore((s) => s.closeDetail);
  const openCreateForm = useAppointmentStore((s) => s.openCreateForm);
  const openDetail = useAppointmentStore((s) => s.openDetail);

  return (
    <AppointmentsLayout>
      <AppointmentListView
        onAppointmentClick={(id) => openDetail(id)}
        onNewClick={() => openCreateForm()}
      />

      <AppointmentFormDialog
        open={isFormOpen}
        onClose={closeForm}
        editingId={editingAppointmentId}
      />

      <AppointmentDetailPanel
        appointmentId={selectedAppointmentId}
        open={isDetailOpen}
        onClose={closeDetail}
      />
    </AppointmentsLayout>
  );
}
