'use client';

import { Button } from '@/components/ui/button';
import { Pencil, Trash2 } from 'lucide-react';

interface ServiceCardProps {
  id: string;
  name: string;
  description?: string | null | undefined;
  durationMins: number;
  price: number;
  color?: string | null | undefined;
  isActive: boolean;
  onEdit: (id: string) => void;
  onDelete: (id: string) => void;
}

export function ServiceCard({ id, name, description, durationMins, price, color, isActive, onEdit, onDelete }: ServiceCardProps) {
  return (
    <div className="rounded-lg border border-espresso/10 p-4 flex items-start justify-between group hover:shadow-sm transition-shadow">
      <div className="flex items-start gap-3">
        {color && <div className="w-4 h-4 rounded-full mt-1 shrink-0" style={{ backgroundColor: color }} />}
        <div>
          <h4 className="font-medium text-espresso">{name}</h4>
          {description && <p className="text-sm text-espresso/50 mt-0.5">{description}</p>}
          <div className="flex gap-3 mt-1.5 text-sm text-espresso/60">
            <span>{durationMins} min</span>
            <span>${price.toFixed(2)}</span>
            {!isActive && <span className="text-red-500">Inactive</span>}
          </div>
        </div>
      </div>
      <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        <Button variant="ghost" size="icon" onClick={() => onEdit(id)}>
          <Pencil className="h-4 w-4" />
        </Button>
        <Button variant="ghost" size="icon" onClick={() => onDelete(id)}>
          <Trash2 className="h-4 w-4 text-red-500" />
        </Button>
      </div>
    </div>
  );
}
