'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useCategories } from '@/hooks/useCategories';
import { useBrands } from '@/hooks/useBrands';
import { toast } from 'sonner';

interface ImportPreviewTableProps {
  data: Record<string, string>[];
  mapping: Record<string, string>;
  onBack: () => void;
}

type RowStatus = 'valid' | 'warning' | 'error';

interface ValidatedRow {
  rowNumber: number;
  mappedData: Record<string, string>;
  status: RowStatus;
  errors: string[];
}

const VALID_GENDERS = ['men', 'man', 'male', 'women', 'woman', 'female', 'unisex', 'kids', 'kid', 'children', 'toddlers', 'toddler'];
const ROWS_PER_PAGE = 25;

function getMappedValue(row: Record<string, string>, mapping: Record<string, string>, field: string): string {
  const csvHeader = mapping[field];
  if (!csvHeader) return '';
  return (row[csvHeader] ?? '').trim();
}

export function ImportPreviewTable({ data, mapping, onBack }: ImportPreviewTableProps) {
  const router = useRouter();
  const { data: categoriesData } = useCategories();
  const { data: brandsData } = useBrands();
  const [expandedRow, setExpandedRow] = useState<number | null>(null);
  const [page, setPage] = useState(0);
  const [isImporting, setIsImporting] = useState(false);

  const existingCategories = useMemo(
    () => new Set((categoriesData?.data ?? []).map((c) => c.name.toLowerCase().trim())),
    [categoriesData],
  );

  const existingBrands = useMemo(
    () => new Set((brandsData?.data ?? []).map((b) => b.name.toLowerCase().trim())),
    [brandsData],
  );

  const validatedRows = useMemo<ValidatedRow[]>(() => {
    return data.map((row, idx) => {
      const mapped: Record<string, string> = {};
      for (const [field, csvHeader] of Object.entries(mapping)) {
        mapped[field] = ((row[csvHeader] as string | undefined) ?? '').trim();
      }

      const errors: string[] = [];
      let status: RowStatus = 'valid';

      // Error checks
      if (!mapped.productName) {
        errors.push('Product Name is required');
        status = 'error';
      }

      const retailPriceStr = mapped.retailPrice ?? '';
      const retailPrice = parseFloat(retailPriceStr);
      if (!retailPriceStr || isNaN(retailPrice) || retailPrice <= 0) {
        errors.push('Retail Price must be a positive number');
        status = 'error';
      }

      if (!mapped.category) {
        errors.push('Category is required');
        status = 'error';
      }

      if (!mapped.sku && !mapped.barcode) {
        errors.push('Either SKU or Barcode is required');
        status = 'error';
      }

      // Warning checks (only if not already error)
      if (status !== 'error') {
        if (mapped.category && !existingCategories.has(mapped.category.toLowerCase())) {
          errors.push(`Category "${mapped.category}" will be created`);
          status = 'warning';
        }
        if (mapped.brand && !existingBrands.has(mapped.brand.toLowerCase())) {
          errors.push(`Brand "${mapped.brand}" will be created`);
          status = 'warning';
        }
        if (mapped.gender && !VALID_GENDERS.includes(mapped.gender.toLowerCase())) {
          errors.push(`Gender "${mapped.gender}" is unrecognized, will default to UNISEX`);
          status = 'warning';
        }
      }

      return { rowNumber: idx + 1, mappedData: mapped, status, errors };
    });
  }, [data, mapping, existingCategories, existingBrands]);

  const validCount = validatedRows.filter((r) => r.status === 'valid').length;
  const warningCount = validatedRows.filter((r) => r.status === 'warning').length;
  const errorCount = validatedRows.filter((r) => r.status === 'error').length;
  const importableCount = validCount + warningCount;

  const totalPages = Math.ceil(validatedRows.length / ROWS_PER_PAGE);
  const pageRows = validatedRows.slice(page * ROWS_PER_PAGE, (page + 1) * ROWS_PER_PAGE);

  const handleImport = async () => {
    const importableRows = validatedRows
      .filter((r) => r.status !== 'error')
      .map((r) => {
        const d = r.mappedData;
        const row: Record<string, unknown> = {
          productName: d.productName,
          category: d.category,
          retailPrice: parseFloat(d.retailPrice ?? '0'),
        };
        if (d.sku) row.sku = d.sku;
        if (d.barcode) row.barcode = d.barcode;
        if (d.brand) row.brand = d.brand;
        if (d.description) row.description = d.description;
        if (d.gender) row.gender = d.gender;
        if (d.tags) row.tags = d.tags;
        if (d.costPrice) row.costPrice = parseFloat(d.costPrice as string);
        if (d.size) row.size = d.size;
        if (d.colour) row.colour = d.colour;
        if (d.lowStockThreshold) row.lowStockThreshold = parseInt(d.lowStockThreshold, 10);
        if (d.wholesalePrice) row.wholesalePrice = parseFloat(d.wholesalePrice);
        return row;
      });

    setIsImporting(true);
    try {
      const res = await fetch('/api/store/products/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rows: importableRows }),
      });
      const json = await res.json();
      if (!res.ok) {
        toast.error(`Import failed: ${json.error?.message ?? 'Unknown error'}`);
        return;
      }
      toast.success(
        `${json.data.productsCreated} products created, ${json.data.variantsCreated} variants added.`,
      );
      router.push('/inventory');
    } catch {
      toast.error('Import failed: network error');
    } finally {
      setIsImporting(false);
    }
  };

  const statusBadge = (status: RowStatus) => {
    switch (status) {
      case 'valid':
        return <Badge variant="success">Valid</Badge>;
      case 'warning':
        return <Badge variant="warning">Warning</Badge>;
      case 'error':
        return <Badge variant="destructive">Error</Badge>;
    }
  };

  return (
    <div className="space-y-4">
      {/* Summary bar */}
      <div className="flex gap-4 rounded-lg border border-sand bg-pearl px-4 py-3 font-body text-sm">
        <span className="text-green-700">{validCount} valid</span>
        <span className="text-amber-600">{warningCount} warnings</span>
        <span className="text-red-600">{errorCount} errors</span>
      </div>

      {/* Preview table */}
      <div className="overflow-x-auto rounded-lg border border-sand">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-sand bg-linen">
              <th className="w-8 px-3 py-2" />
              <th className="px-4 py-2 text-left font-body font-semibold text-espresso">Row</th>
              <th className="px-4 py-2 text-left font-body font-semibold text-espresso">Product Name</th>
              <th className="px-4 py-2 text-left font-body font-semibold text-espresso">SKU</th>
              <th className="px-4 py-2 text-right font-body font-semibold text-espresso">Retail Price</th>
              <th className="px-4 py-2 text-center font-body font-semibold text-espresso">Status</th>
            </tr>
          </thead>
          <tbody>
            {pageRows.map((row) => (
              <>
                <tr
                  key={row.rowNumber}
                  className="border-b border-sand last:border-b-0 cursor-pointer hover:bg-linen/50"
                  onClick={() =>
                    setExpandedRow(expandedRow === row.rowNumber ? null : row.rowNumber)
                  }
                >
                  <td className="px-3 py-2 text-mist">
                    {expandedRow === row.rowNumber ? (
                      <ChevronDown className="h-4 w-4" />
                    ) : (
                      <ChevronRight className="h-4 w-4" />
                    )}
                  </td>
                  <td className="px-4 py-2 font-mono text-xs text-mist">{row.rowNumber}</td>
                  <td className="px-4 py-2 font-body text-espresso">{row.mappedData.productName || '—'}</td>
                  <td className="px-4 py-2 font-mono text-xs text-espresso">{row.mappedData.sku || '—'}</td>
                  <td className="px-4 py-2 text-right font-mono text-xs text-espresso">
                    {row.mappedData.retailPrice || '—'}
                  </td>
                  <td className="px-4 py-2 text-center">{statusBadge(row.status)}</td>
                </tr>
                {expandedRow === row.rowNumber && (
                  <tr key={`${row.rowNumber}-detail`} className="border-b border-sand bg-linen/30">
                    <td colSpan={6} className="px-8 py-3">
                      <div className="space-y-1">
                        <div className="grid grid-cols-2 gap-x-6 gap-y-1 font-body text-xs text-espresso">
                          {Object.entries(row.mappedData)
                            .filter(([, v]) => v)
                            .map(([k, v]) => (
                              <div key={k}>
                                <span className="font-semibold">{k}:</span> {v}
                              </div>
                            ))}
                        </div>
                        {row.errors.length > 0 && (
                          <div className="mt-2 space-y-0.5">
                            {row.errors.map((err, i) => (
                              <p
                                key={i}
                                className={`font-body text-xs ${
                                  row.status === 'error' ? 'text-red-600' : 'text-amber-600'
                                }`}
                              >
                                • {err}
                              </p>
                            ))}
                          </div>
                        )}
                      </div>
                    </td>
                  </tr>
                )}
              </>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 font-body text-sm text-espresso">
          <Button
            variant="outline"
            size="sm"
            disabled={page === 0}
            onClick={() => setPage((p) => p - 1)}
            className="border-mist"
          >
            ← Prev
          </Button>
          <span>
            Page {page + 1} of {totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={page >= totalPages - 1}
            onClick={() => setPage((p) => p + 1)}
            className="border-mist"
          >
            Next →
          </Button>
        </div>
      )}

      {/* Action buttons */}
      <div className="flex items-center justify-between rounded-lg border border-sand bg-pearl px-4 py-3">
        <Button
          variant="outline"
          onClick={onBack}
          className="border-mist text-espresso"
        >
          ← Go back to fix
        </Button>
        <Button
          disabled={importableCount === 0 || isImporting}
          onClick={handleImport}
          className="bg-espresso text-pearl hover:bg-espresso/90 disabled:opacity-50"
        >
          {isImporting
            ? 'Importing…'
            : errorCount > 0
              ? `Skip ${errorCount} errors and import ${importableCount} rows`
              : `Import ${importableCount} rows`}
        </Button>
      </div>
    </div>
  );
}
