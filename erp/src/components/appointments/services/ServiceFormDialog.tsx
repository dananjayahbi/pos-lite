'use client';

import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

interface ServiceFormData {
  name: string;
  description: string;
  durationMins: number;
  price: number;
  color: string;
  isActive: boolean;
  sortOrder: number;
}

interface ServiceFormDialogProps {
  open: boolean;
  onClose: () => void;
  editingId?: string | null;
  initialData?: Partial<ServiceFormData>;
}

export function ServiceFormDialog({ open, onClose, editingId, initialData }: ServiceFormDialogProps) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState<ServiceFormData>({
    name: '', description: '', durationMins: 30, price: 0, color: '#6366f1', isActive: true, sortOrder: 0,
  });

  useEffect(() => {
    if (initialData) {
      setForm({ name: '', description: '', durationMins: 30, price: 0, color: '#6366f1', isActive: true, sortOrder: 0, ...initialData });
    }
  }, [initialData, editingId]);

  const mutation = useMutation({
    mutationFn: async (data: ServiceFormData) => {
      const url = editingId ? `/api/store/appointments/services/${editingId}` : '/api/store/appointments/services';
      const method = editingId ? 'PATCH' : 'POST';
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error?.message ?? 'Failed to save');
      return json.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['appointment-services'] });
      toast.success(editingId ? 'Service updated' : 'Service created');
      onClose();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    mutation.mutate(form);
  };

  const COLORS = ['#3B82F6', '#6366F1', '#8B5CF6', '#EC4899', '#EF4444', '#F59E0B', '#22C55E', '#14B8A6'];

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{editingId ? 'Edit Service' : 'New Service'}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label>Name</Label>
            <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
          </div>
          <div className="space-y-1.5">
            <Label>Description</Label>
            <Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={2} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Duration (min)</Label>
              <Input type="number" value={form.durationMins} onChange={(e) => setForm({ ...form, durationMins: parseInt(e.target.value) || 30 })} min={5} />
            </div>
            <div className="space-y-1.5">
              <Label>Price ($)</Label>
              <Input type="number" value={form.price} onChange={(e) => setForm({ ...form, price: parseFloat(e.target.value) || 0 })} min={0} step={0.01} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Color</Label>
            <div className="flex gap-2">
              {COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  className={`w-8 h-8 rounded-full border-2 transition-all ${form.color === c ? 'border-espresso scale-110' : 'border-transparent'}`}
                  style={{ backgroundColor: c }}
                  onClick={() => setForm({ ...form, color: c })}
                />
              ))}
            </div>
          </div>
          <div className="flex items-center justify-between">
            <Label>Active</Label>
            <Switch checked={form.isActive} onCheckedChange={(v) => setForm({ ...form, isActive: v })} />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled={mutation.isPending || !form.name.trim()}>
              {mutation.isPending ? 'Saving...' : editingId ? 'Update' : 'Create'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
