'use client';

import { useState, type KeyboardEvent } from 'react';
import { X, Pill, Plus } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { FormPickerModal } from './FormPickerModal';
import {
  PRODUCT_FORM_LABELS,
  PRODUCT_FORM_ICONS,
  type ProductFormValue,
} from '@/lib/constants/product-options';

/**
 * Form chip input — replaces the clothing colour-chip input.
 *
 * Accepts free-text forms (e.g. "Custom Form") but also lets the user
 * browse the curated ayurveda dosage-form catalogue via the picker modal.
 */

interface FormChipInputProps {
  value: string[];
  onChange: (forms: string[]) => void;
}

function getFormLabel(form: string): string {
  if (
    Object.prototype.hasOwnProperty.call(PRODUCT_FORM_LABELS, form)
  ) {
    return PRODUCT_FORM_LABELS[form as ProductFormValue];
  }
  return form;
}

function getFormIcon(form: string) {
  if (
    Object.prototype.hasOwnProperty.call(PRODUCT_FORM_ICONS, form)
  ) {
    return PRODUCT_FORM_ICONS[form as ProductFormValue];
  }
  return Pill;
}

export function FormChipInput({ value, onChange }: FormChipInputProps) {
  const [input, setInput] = useState('');
  const [pickerOpen, setPickerOpen] = useState(false);

  const addForm = (raw: string) => {
    const form = raw.trim().toUpperCase().replace(/\s+/g, '_');
    if (!form) return;
    if (value.some((f) => f.toLowerCase() === form.toLowerCase())) return;
    onChange([...value, form]);
    setInput('');
  };

  const removeForm = (index: number) => {
    onChange(value.filter((_, i) => i !== index));
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      addForm(input);
    }
    if (e.key === 'Backspace' && !input && value.length > 0) {
      removeForm(value.length - 1);
    }
  };

  const handlePickerInsert = (forms: string[]) => {
    onChange([...value, ...forms]);
  };

  return (
    <div>
      <div className="flex flex-wrap gap-2 mb-2">
        {value.map((form, i) => {
          const Icon = getFormIcon(form);
          return (
            <span
              key={`${form}-${i}`}
              className="inline-flex items-center gap-1.5 bg-espresso text-pearl rounded-full px-3 py-1 text-xs font-semibold"
            >
              <Icon className="h-3 w-3" />
              {getFormLabel(form)}
              <button
                type="button"
                onClick={() => removeForm(i)}
                className="hover:text-sand transition-colors"
              >
                <X className="h-3 w-3" />
              </button>
            </span>
          );
        })}
      </div>
      <div className="flex items-center gap-2">
        <Input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Type a form (e.g. POWDER) and press Enter"
          className="font-body flex-1"
        />
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => setPickerOpen(true)}
          className="shrink-0 gap-1.5 border-mist text-espresso hover:bg-linen hover:border-espresso"
        >
          <Plus className="h-4 w-4" />
          Browse
        </Button>
      </div>
      <FormPickerModal
        open={pickerOpen}
        onOpenChange={setPickerOpen}
        existingForms={value}
        onInsert={handlePickerInsert}
      />
    </div>
  );
}