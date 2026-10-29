'use client';

import { useCallback, useRef } from 'react';

import { Plus, Trash2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { formatRupee } from '@/lib/format';

import { POVariantSearchInput, variantLabel, type VariantSearchResult } from './POVariantSearchInput';
import type { POLineDraft } from './poTypes';

/**
 * Order-line editor for a purchase order.
 *
 * A line is picked by searching a variant (which seeds the expected cost) and is
 * then editable in place. The parent owns the array so the summary panel and the
 * payload builder read exactly what is on screen.
 */
interface POLinesEditorProps {
  lines: POLineDraft[];
  onChange: (lines: POLineDraft[]) => void;
  /** Submit-time errors keyed `lines.<index>.<field>`. */
  errors?: Record<string, string>;
  disabled?: boolean | undefined;
}

export function POLinesEditor({ lines, onChange, errors, disabled }: POLinesEditorProps) {
  const nextKey = useRef(lines.length);

  const addLine = useCallback(() => {
    nextKey.current += 1;
    onChange([
      ...lines,
      {
        key: `line-${nextKey.current}`,
        variantId: '',
        label: '',
        orderedQty: 1,
        expectedCostPrice: 0,
      },
    ]);
  }, [lines, onChange]);

  const updateLine = useCallback(
    (index: number, patch: Partial<POLineDraft>) => {
      onChange(lines.map((line, i) => (i === index ? { ...line, ...patch } : line)));
    },
    [lines, onChange],
  );

  const removeLine = useCallback(
    (index: number) => {
      onChange(lines.filter((_, i) => i !== index));
    },
    [lines, onChange],
  );

  const selectVariant = useCallback(
    (index: number, variant: VariantSearchResult) => {
      const cost = Number.parseFloat(String(variant.costPrice));
      updateLine(index, {
        variantId: variant.id,
        label: variantLabel(variant),
        expectedCostPrice: Number.isFinite(cost) ? Math.round(cost * 100) / 100 : 0,
      });
    },
    [updateLine],
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span>Order Lines</span>
          <Button type="button" variant="outline" size="sm" onClick={addLine} disabled={disabled}>
            <Plus className="mr-1 h-4 w-4" />
            Add Line
          </Button>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {lines.length === 0 && (
          <p className="py-4 text-center text-sm text-mist">
            No lines added yet. Click &quot;Add Line&quot; to start.
          </p>
        )}
        {errors?.['lines'] ? <p className="text-sm text-red-600">{errors['lines']}</p> : null}

        {lines.map((line, index) => {
          const lineTotal = line.orderedQty * line.expectedCostPrice;
          return (
            <div
              key={line.key}
              className="space-y-3 rounded-lg border border-sand/30 bg-pearl/60 p-4"
            >
              <div className="flex items-start justify-between gap-2">
                <span className="min-w-0 text-sm font-medium text-espresso">
                  Line {index + 1}
                  {line.label ? (
                    <span className="ml-2 font-normal text-mist">— {line.label}</span>
                  ) : null}
                </span>
                <div className="flex shrink-0 items-center gap-2">
                  <span className="font-mono text-xs text-mist">{formatRupee(lineTotal)}</span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => removeLine(index)}
                    disabled={disabled}
                    aria-label={`Remove line ${index + 1}`}
                  >
                    <Trash2 className="h-4 w-4 text-red-500" />
                  </Button>
                </div>
              </div>

              {line.variantId === '' ? (
                <POVariantSearchInput
                  lineNumber={index + 1}
                  onSelect={(variant) => selectVariant(index, variant)}
                  {...(disabled !== undefined ? { disabled } : {})}
                />
              ) : null}

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label htmlFor={`po-line-${index}-qty`}>Ordered Qty</Label>
                  <Input
                    id={`po-line-${index}-qty`}
                    type="number"
                    min={1}
                    step={1}
                    value={Number.isFinite(line.orderedQty) ? line.orderedQty : ''}
                    onChange={(event) =>
                      updateLine(index, { orderedQty: Number.parseInt(event.target.value, 10) })
                    }
                    disabled={disabled}
                  />
                  {errors?.[`lines.${index}.orderedQty`] ? (
                    <p className="text-sm text-red-600">{errors[`lines.${index}.orderedQty`]}</p>
                  ) : null}
                </div>
                <div className="space-y-1">
                  <Label htmlFor={`po-line-${index}-cost`}>Expected Cost Price</Label>
                  <Input
                    id={`po-line-${index}-cost`}
                    type="number"
                    step="0.01"
                    min={0}
                    value={Number.isFinite(line.expectedCostPrice) ? line.expectedCostPrice : ''}
                    onChange={(event) =>
                      updateLine(index, { expectedCostPrice: Number.parseFloat(event.target.value) })
                    }
                    disabled={disabled}
                  />
                  {errors?.[`lines.${index}.expectedCostPrice`] ? (
                    <p className="text-sm text-red-600">
                      {errors[`lines.${index}.expectedCostPrice`]}
                    </p>
                  ) : null}
                </div>
              </div>

              {errors?.[`lines.${index}.variantId`] ? (
                <p className="text-sm text-red-600">{errors[`lines.${index}.variantId`]}</p>
              ) : null}
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
