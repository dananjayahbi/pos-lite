'use client';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Trash2, Plus } from 'lucide-react';

interface RateEntry {
  id?: string;
  originDistrictId?: number | null;
  destinationDistrictId?: number | null;
  destinationCityId?: number | null;
  baseRate?: number | null;
  extraKgRate?: number | null;
}

export interface RateZoneDistrictOption {
  id: number;
  text: string;
}

export interface RateZoneCityOption {
  id: number | null;
  name: string;
}

interface RateMatrixTableProps {
  entries: RateEntry[];
  onChange: (entries: RateEntry[]) => void;
  /** Synced courier districts; empty when locations have not been synced. */
  districts?: RateZoneDistrictOption[];
  /** Synced/fallback courier cities; entries without a numeric id are omitted. */
  cities?: RateZoneCityOption[];
}

const ANY_VALUE = '__any__';

const NUMERIC_FIELDS: {
  key: 'baseRate' | 'extraKgRate';
  label: string;
  placeholder: string;
}[] = [
  { key: 'baseRate', label: 'Base Rate (Rs)', placeholder: 'e.g. 250' },
  { key: 'extraKgRate', label: 'Extra Kg Rate (Rs)', placeholder: 'e.g. 40' },
];

interface SelectOption {
  value: string;
  label: string;
}

function withCurrentValue(options: SelectOption[], current: number | null | undefined): SelectOption[] {
  if (current === null || current === undefined) return options;
  const value = String(current);
  if (options.some((option) => option.value === value)) return options;
  return [...options, { value, label: `ID ${current} (not in synced list)` }];
}

/**
 * Editable destination zone matrix. Rows are upserted against the active rate
 * card on save (entries with an `id` are updated, others are created).
 *
 * ARGUS #290: district/city are picked by name from the synced courier master
 * data, not typed as raw numeric ids. There is no origin column because the
 * pricing engine does not read `originDistrictId`.
 */
export function RateMatrixTable({
  entries,
  onChange,
  districts = [],
  cities = [],
}: RateMatrixTableProps) {
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

  const districtOptions: SelectOption[] = [
    { value: ANY_VALUE, label: 'Any district' },
    ...districts.map((district) => ({
      value: String(district.id),
      label: district.text,
    })),
  ];

  const cityOptions: SelectOption[] = [
    { value: ANY_VALUE, label: 'Any city' },
    ...cities
      .filter((city): city is { id: number; name: string } => city.id !== null)
      .map((city) => ({ value: String(city.id), label: city.name })),
  ];

  const renderLocationSelect = (
    index: number,
    key: 'destinationDistrictId' | 'destinationCityId',
    label: string,
    baseOptions: SelectOption[],
    current: number | null | undefined,
  ) => {
    const options = withCurrentValue(baseOptions, current);
    return (
      <Select
        value={current === null || current === undefined ? ANY_VALUE : String(current)}
        onValueChange={(value) =>
          updateRow(index, key, value === ANY_VALUE ? null : Number(value))
        }
      >
        <SelectTrigger className="h-8 min-w-36 text-sm" aria-label={`${label} for row ${index + 1}`}>
          <SelectValue placeholder={label} />
        </SelectTrigger>
        <SelectContent>
          {options.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    );
  };

  return (
    <div className="space-y-3">
      <div className="overflow-x-auto rounded-lg border border-espresso/10">
        <table className="w-full min-w-180">
          <thead>
            <tr className="border-b border-espresso/10 bg-espresso/5">
              <th className="px-3 py-2 text-left text-xs font-medium text-espresso/60">
                Dest District
              </th>
              <th className="px-3 py-2 text-left text-xs font-medium text-espresso/60">
                Dest City
              </th>
              <th className="px-3 py-2 text-left text-xs font-medium text-espresso/60">
                Base Rate (Rs)
              </th>
              <th className="px-3 py-2 text-left text-xs font-medium text-espresso/60">
                Extra Kg (Rs)
              </th>
              <th className="px-3 py-2 w-12" />
            </tr>
          </thead>
          <tbody>
            {entries.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-3 py-8 text-center text-sm text-espresso/40">
                  No zone overrides yet. Add a row to define a destination-specific rate.
                </td>
              </tr>
            ) : (
              entries.map((entry, index) => (
                <tr key={entry.id ?? index} className="border-b border-espresso/5 last:border-0">
                  <td className="px-3 py-2">
                    {renderLocationSelect(
                      index,
                      'destinationDistrictId',
                      'Destination district',
                      districtOptions,
                      entry.destinationDistrictId,
                    )}
                  </td>
                  <td className="px-3 py-2">
                    {renderLocationSelect(
                      index,
                      'destinationCityId',
                      'Destination city',
                      cityOptions,
                      entry.destinationCityId,
                    )}
                  </td>
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
