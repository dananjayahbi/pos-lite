'use client';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Trash2, Plus } from 'lucide-react';

interface RateEntry {
  id?: string;
  originDistrictId?: number | null;
  destinationDistrictId?: number | null;
  destinationCityId?: number | null;
  baseRate?: number | null;
  extraKgRate?: number | null;
}

interface RateMatrixTableProps {
  entries: RateEntry[];
  onChange: (entries: RateEntry[]) => void;
}

const NUMERIC_FIELDS: { key: keyof RateEntry; label: string; placeholder: string }[] = [
  { key: 'originDistrictId', label: 'Origin District ID', placeholder: 'e.g. 12' },
  { key: 'destinationDistrictId', label: 'Dest District ID', placeholder: 'e.g. 14' },
  { key: 'destinationCityId', label: 'Dest City ID', placeholder: 'e.g. 201' },
  { key: 'baseRate', label: 'Base Rate (Rs)', placeholder: 'e.g. 250' },
  { key: 'extraKgRate', label: 'Extra Kg Rate (Rs)', placeholder: 'e.g. 40' },
];

/**
 * Editable zone-override rate matrix. Rows are upserted against the active rate
 * card on save (entries with an `id` are updated, others are created).
 */
export function RateMatrixTable({ entries, onChange }: RateMatrixTableProps) {
  const updateRow = (index: number, key: keyof RateEntry, value: number | null) => {
    const next = entries.map((entry, i) =>
      i === index ? { ...entry, [key]: value } : entry,
    );
    onChange(next);
  };

  const addRow = () => {
    onChange([
      ...entries,
      {
        originDistrictId: null,
        destinationDistrictId: null,
        destinationCityId: null,
        baseRate: null,
        extraKgRate: null,
      },
    ]);
  };

  const removeRow = (index: number) => {
    onChange(entries.filter((_, i) => i !== index));
  };

  return (
    <div className="space-y-3">
      <div className="overflow-x-auto rounded-lg border border-espresso/10">
        <table className="w-full min-w-180">
          <thead>
            <tr className="border-b border-espresso/10 bg-espresso/5">
              <th className="px-3 py-2 text-left text-xs font-medium text-espresso/60">Origin District</th>
              <th className="px-3 py-2 text-left text-xs font-medium text-espresso/60">Dest District</th>
              <th className="px-3 py-2 text-left text-xs font-medium text-espresso/60">Dest City</th>
              <th className="px-3 py-2 text-left text-xs font-medium text-espresso/60">Base Rate (Rs)</th>
              <th className="px-3 py-2 text-left text-xs font-medium text-espresso/60">Extra Kg (Rs)</th>
              <th className="px-3 py-2 w-12" />
            </tr>
          </thead>
          <tbody>
            {entries.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-3 py-8 text-center text-sm text-espresso/40">
                  No zone overrides yet. Add a row to define a specific origin → destination rate.
                </td>
              </tr>
            ) : (
              entries.map((entry, index) => (
                <tr key={entry.id ?? index} className="border-b border-espresso/5 last:border-0">
                  {NUMERIC_FIELDS.map((field) => (
                    <td key={field.key} className="px-3 py-2">
                      <Input
                        type="number"
                        step="any"
                        min={0}
                        aria-label={field.label}
                        value={entry[field.key] ?? ''}
                        placeholder={field.placeholder}
                        onChange={(e) => {
                          const raw = e.target.value;
                          updateRow(index, field.key, raw === '' ? null : Number(raw));
                        }}
                        className="h-8 text-sm"
                      />
                    </td>
                  ))}
                  <td className="px-3 py-2">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      onClick={() => removeRow(index)}
                      className="text-terracotta"
                      aria-label="Remove row"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <Button type="button" variant="outline" size="sm" onClick={addRow}>
        <Plus className="h-4 w-4" />
        Add Zone Override
      </Button>
    </div>
  );
}
