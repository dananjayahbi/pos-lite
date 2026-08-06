'use client';

import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { AppointmentForm } from './AppointmentForm';
import { useCreateAppointment, useUpdateAppointment } from '@/hooks/appointments';

interface AppointmentFormDialogProps {
  open: boolean;
  onClose: () => void;
  editingId?: string | null;
  defaultDate?: Date | null;
  initialData?: Record<string, unknown>;
}

export function AppointmentFormDialog({ open, onClose, editingId, defaultDate, initialData }: AppointmentFormDialogProps) {
  const createMutation = useCreateAppointment();
  const updateMutation = useUpdateAppointment();

  const handleSubmit = async (data: Record<string, unknown>) => {
    if (editingId) {
      await updateMutation.mutateAsync({ id: editingId, data });
    } else {
      await createMutation.mutateAsync(data);
    }
    onClose();
  };

  const isSubmitting = createMutation.isPending || updateMutation.isPending;

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-auto">
        <DialogHeader>
          <DialogTitle>{editingId ? 'Edit Appointment' : 'New Appointment'}</DialogTitle>
        </DialogHeader>
        <AppointmentForm
          initialData={(initialData ?? {}) as Partial<Record<string, unknown>>}
          defaultStartDate={defaultDate}
          onSubmit={handleSubmit}
          onCancel={onClose}
          isSubmitting={isSubmitting}
        />
      </DialogContent>
    </Dialog>
  );
}
