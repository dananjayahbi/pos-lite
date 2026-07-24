'use client';

import { useState, useMemo } from 'react';
import { Search, X, Pill, type LucideIcon } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  PRODUCT_FORMS,
  PRODUCT_FORM_LABELS,
  PRODUCT_FORM_ICONS,
  type ProductFormValue,
} from '@/lib/constants/product-options';

/**
 * Form picker modal — replaces the clothing colour-picker.
 *
 * Ayurveda dosage forms (POWDER, TABLET, CAPSULE, OIL, …) are a closed set,
 * so we present them as chips with icons instead of free-form colour names.
 */

interface FormEntry {
  value: ProductFormValue;
  label: string;
  icon: LucideIcon;
}

export const FORM_CATALOGUE: FormEntry[] = PRODUCT_FORMS.map((value) => ({
  value,
  label: PRODUCT_FORM_LABELS[value],
  icon: PRODUCT_FORM_ICONS[value],
}));

interface FormPickerModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  existingForms: string[];
  onInsert: (forms: string[]) => void;
}

export function FormPickerModal({
  open,
  onOpenChange,
  existingForms,
  onInsert,
}: FormPickerModalProps) {
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<Set<ProductFormValue>>(new Set());

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return FORM_CATALOGUE;
    return FORM_CATALOGUE.filter((f) => f.label.toLowerCase().includes(q));
  }, [search]);

  const toggle = (value: ProductFormValue) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(value)) next.delete(value);
      else next.add(value);
      return next;
    });
  };

  const handleInsert = () => {
    if (selected.size === 0) return;
    const newOnes = Array.from(selected).filter(
      (s) => !existingForms.some((e) => e.toLowerCase() === s.toLowerCase()),
    );
    if (newOnes.length > 0) onInsert(newOnes);
    setSelected(new Set());
    setSearch('');
    onOpenChange(false);
  };

  const handleClose = () => {
    setSelected(new Set());
    setSearch('');
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[560px] max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="font-display text-espresso flex items-center gap-2">
            <Pill className="h-5 w-5" />
            Choose dosage forms
          </DialogTitle>
        </DialogHeader>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-mist" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search forms…"
            className="pl-9 font-body"
            autoFocus
          />
        </div>

        <div className="flex-1 overflow-y-auto pr-1 -mr-1">
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 py-2">
            {filtered.map((f) => {
              const Icon = f.icon;
              const isSelected = selected.has(f.value);
              return (
                <button
                  key={f.value}
                  type="button"
                  onClick={() => toggle(f.value)}
                  className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-left text-sm font-medium transition-colors ${
                    isSelected
                      ? 'border-espresso bg-espresso text-pearl'
                      : 'border-sand text-espresso hover:bg-linen'
                  }`}
                >
                  <Icon className="h-4 w-4 shrink-0" />
                  <span className="truncate">{f.label}</span>
                </button>
              );
            })}
          </div>
          {filtered.length === 0 && (
            <p className="py-8 text-center text-sm text-mist">No matching forms</p>
          )}
        </div>

        <div className="flex items-center justify-between gap-2 border-t border-mist pt-3">
          <span className="text-xs text-mist">
            {selected.size > 0 ? `${selected.size} selected` : 'Pick one or more'}
          </span>
          <div className="flex gap-2">
            <Button type="button" variant="outline" onClick={handleClose}>
              Cancel
            </Button>
            <Button
              type="button"
              onClick={handleInsert}
              disabled={selected.size === 0}
              className="bg-espresso text-pearl hover:bg-espresso/90"
            >
              <X className="h-4 w-4 mr-1 rotate-45" />
              Add selected
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}