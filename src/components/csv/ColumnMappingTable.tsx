'use client';

import { useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface ColumnMappingTableProps {
  headers: string[];
  data: Record<string, string>[];
  onMappingConfirmed: (mapping: Record<string, string>) => void;
  onBack: () => void;
}

const EXPECTED_FIELDS = [
  { key: 'productName', label: 'Product Name', required: true },
  { key: 'category', label: 'Category', required: true },
  { key: 'retailPrice', label: 'Retail Price', required: true },
  { key: 'sku', label: 'SKU', required: false },
  { key: 'barcode', label: 'Barcode', required: false },
  { key: 'brand', label: 'Brand', required: false },
  { key: 'description', label: 'Description', required: false },
  { key: 'gender', label: 'Gender', required: false },
  { key: 'tags', label: 'Tags', required: false },
  { key: 'costPrice', label: 'Cost Price', required: false },
  { key: 'size', label: 'Size', required: false },
  { key: 'colour', label: 'Colour', required: false },
  { key: 'lowStockThreshold', label: 'Low Stock Threshold', required: false },
  { key: 'wholesalePrice', label: 'Wholesale Price', required: false },
] as const;

const NOT_MAPPED = '__not_mapped__';

function autoDetect(headers: string[]): Record<string, string> {
  const mapping: Record<string, string> = {};
  for (const field of EXPECTED_FIELDS) {
    const match = headers.find(
      (h) => h.toLowerCase().trim() === field.label.toLowerCase(),
    );
    if (match) mapping[field.key] = match;
  }
  return mapping;
}

export function ColumnMappingTable({
  headers,
  data,
  onMappingConfirmed,
  onBack,
}: ColumnMappingTableProps) {
  const [mapping, setMapping] = useState<Record<string, string>>(() =>
    autoDetect(headers),
  );

  const requiredFields = EXPECTED_FIELDS.filter((f) => f.required);
  const mappedRequiredCount = requiredFields.filter((f) => mapping[f.key]).length;
  const unmappedRequiredCount = requiredFields.length - mappedRequiredCount;
  const allRequiredMapped = unmappedRequiredCount === 0;

  const previewValues = useMemo(() => {
    const result: Record<string, string[]> = {};
    for (const field of EXPECTED_FIELDS) {
      const csvHeader = mapping[field.key];
      if (!csvHeader) {
        result[field.key] = [];
        continue;
      }
      const values: string[] = [];
      for (const row of data) {
        const v = row[csvHeader]?.trim();
        if (v) {
          values.push(v);
          if (values.length >= 3) break;
        }
      }
      result[field.key] = values;
    }
    return result;
  }, [mapping, data]);

  const handleChange = (fieldKey: string, value: string) => {
    setMapping((prev) => {
      const next = { ...prev };
      if (value === NOT_MAPPED) {
        delete next[fieldKey];
      } else {
        next[fieldKey] = value;
      }
      return next;
    });
  };

  return (
    <div className="space-y-4">
      <div className="overflow-x-auto rounded-lg border border-sand">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-sand bg-linen">
              <th className="px-4 py-2 text-left font-body font-semibold text-espresso">
                VelvetPOS Field
              </th>
              <th className="px-4 py-2 text-left font-body font-semibold text-espresso">
                CSV Column
              </th>
              <th className="px-4 py-2 text-left font-body font-semibold text-espresso">
                Preview
              </th>
            </tr>
          </thead>
          <tbody>
            {EXPECTED_FIELDS.map((field) => (
              <tr key={field.key} className="border-b border-sand last:border-b-0">
                <td className="px-4 py-2 font-body text-espresso">
                  {field.label}
                  {field.required && (
                    <span className="ml-1 text-red-600 text-xs">(Required)</span>
                  )}
                </td>
                <td className="px-4 py-2">
                  <Select
                    value={mapping[field.key] ?? NOT_MAPPED}
                    onValueChange={(v) => handleChange(field.key, v)}
                  >
                    <SelectTrigger className="w-[200px] font-body text-sm">
                      <SelectValue placeholder="— Not mapped —" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={NOT_MAPPED}>— Not mapped —</SelectItem>
                      {headers.map((h) => (
                        <SelectItem key={h} value={h}>
                          {h}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </td>
                <td className="px-4 py-2">
                  {(previewValues[field.key]?.length ?? 0) > 0 ? (
                    <span className="font-body text-xs text-mist italic">
                      {previewValues[field.key]!.join(', ')}
                    </span>
                  ) : (
                    <span className="font-body text-xs text-mist">—</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Validation bar */}
      <div className="flex items-center justify-between rounded-lg border border-sand bg-pearl px-4 py-3">
        <p className="font-body text-sm">
          <span className="text-green-700">
            {mappedRequiredCount} required field{mappedRequiredCount !== 1 ? 's' : ''} mapped
          </span>
          {unmappedRequiredCount > 0 && (
            <>
              {', '}
              <span className="text-red-600">
                {unmappedRequiredCount} required field{unmappedRequiredCount !== 1 ? 's' : ''} not mapped
              </span>
            </>
          )}
        </p>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={onBack}
            className="border-mist text-espresso"
          >
            ← Go Back
          </Button>
          <Button
            disabled={!allRequiredMapped}
            onClick={() => onMappingConfirmed(mapping)}
            className="bg-espresso text-pearl hover:bg-espresso/90 disabled:opacity-50"
          >
            Preview Import →
          </Button>
        </div>
      </div>
    </div>
  );
}
