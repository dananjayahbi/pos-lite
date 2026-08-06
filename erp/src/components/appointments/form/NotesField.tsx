'use client';

import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';

interface NotesFieldProps {
  notes: string;
  customerNotes: string;
  onNotesChange: (notes: string) => void;
  onCustomerNotesChange: (notes: string) => void;
}

export function NotesField({ notes, customerNotes, onNotesChange, onCustomerNotesChange }: NotesFieldProps) {
  return (
    <div className="space-y-3">
      <div className="space-y-1.5">
        <Label className="text-sm font-medium">Internal Notes</Label>
        <Textarea
          value={notes}
          onChange={(e) => onNotesChange(e.target.value)}
          placeholder="Add notes visible only to staff..."
          rows={2}
        />
      </div>
      <div className="space-y-1.5">
        <Label className="text-sm font-medium">Customer Notes</Label>
        <Textarea
          value={customerNotes}
          onChange={(e) => onCustomerNotesChange(e.target.value)}
          placeholder="Notes from the customer..."
          rows={2}
        />
      </div>
    </div>
  );
}
