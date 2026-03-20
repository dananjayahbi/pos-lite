'use client';

import { useState } from 'react';
import Image from 'next/image';
import { ChevronDown, ChevronRight, Pencil, Trash2, Package, Printer } from 'lucide-react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Checkbox } from '@/components/ui/checkbox';
import { VariantEditSheet } from '@/components/product/VariantEditSheet';
import { BarcodeLabelDialog, type LabelVariant } from '@/components/inventory/BarcodeLabelDialog';

// ── Types ────────────────────────────────────────────────────────────────────

interface Variant {
  id: string;
  sku: string;
  barcode: string | null;
  size: string | null;
  colour: string | null;
  costPrice: string | number;
  retailPrice: string | number;
  wholesalePrice: string | number | null;
  stockQuantity: number;
  lowStockThreshold: number;
  imageUrls: string[];
}

interface VariantsTabProps {
  productId: string;
  variants: Variant[];
  permissions: string[];
  productName: string;
  brandName?: string | null | undefined;
}

// ── Stock badge ──────────────────────────────────────────────────────────────

function StockBadge({ qty, threshold }: { qty: number; threshold: number }) {
  let bg = '#2D6A4F';
  if (qty === 0) bg = '#9B2226';
  else if (qty <= threshold) bg = '#B7791F';

  return (
    <span
      className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium text-pearl"
      style={{ backgroundColor: bg }}
    >
      {qty}
    </span>
  );
}

// ── Format price ─────────────────────────────────────────────────────────────

function formatPrice(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return '—';
  const num = typeof value === 'string' ? parseFloat(value) : value;
  if (isNaN(num)) return '—';
  return num.toLocaleString('en-ZA', { style: 'currency', currency: 'ZAR' });
}

// ── Component ────────────────────────────────────────────────────────────────

export function VariantsTab({ productId, variants, permissions, productName, brandName }: VariantsTabProps) {
  const queryClient = useQueryClient();
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Variant | null>(null);
  const [editTarget, setEditTarget] = useState<Variant | null>(null);
  const [selectedVariantIds, setSelectedVariantIds] = useState<Set<string>>(new Set());
  const [labelDialogOpen, setLabelDialogOpen] = useState(false);

  const canViewCost = permissions.includes('product:view_cost_price');
  const canEdit = permissions.includes('product:edit');
  const canDelete = permissions.includes('product:delete');

  const deleteMutation = useMutation({
    mutationFn: async (variantId: string) => {
      const res = await fetch(
        `/api/store/products/${productId}/variants/${variantId}`,
        { method: 'DELETE' },
      );
      if (!res.ok) throw new Error('Failed to delete variant');
      return res.json();
    },
    onSuccess: () => {
      toast.success('Variant deleted');
      queryClient.invalidateQueries({ queryKey: ['product', productId] });
      queryClient.invalidateQueries({ queryKey: ['products'] });
      setDeleteTarget(null);
    },
    onError: () => {
      toast.error('Failed to delete variant');
    },
  });

  if (variants.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-lg border border-sand/30 bg-pearl py-16">
        <Package className="mb-4 h-12 w-12 text-mist" />
        <p className="font-body text-sm text-mist">No variants found</p>
      </div>
    );
  }

  const toggleVariant = (id: string) => {
    setSelectedVariantIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    if (selectedVariantIds.size === variants.length) {
      setSelectedVariantIds(new Set());
    } else {
      setSelectedVariantIds(new Set(variants.map((v) => v.id)));
    }
  };

  const handlePrintLabels = () => {
    if (selectedVariantIds.size === 0) {
      toast.info('Select at least one variant to print labels.');
      return;
    }
    setLabelDialogOpen(true);
  };

  const selectedLabelVariants: LabelVariant[] = variants
    .filter((v) => selectedVariantIds.has(v.id))
    .map((v) => ({
      id: v.id,
      sku: v.sku,
      barcode: v.barcode,
      size: v.size,
      colour: v.colour,
      retailPrice: typeof v.retailPrice === 'string' ? parseFloat(v.retailPrice) : v.retailPrice,
      stockQuantity: v.stockQuantity,
      lowStockThreshold: v.lowStockThreshold,
      brandName,
      productName,
    }));

  return (
    <>
      {/* Toolbar */}
      <div className="flex items-center justify-end mb-3">
        <Button
          variant="outline"
          className="border-sand text-sand"
          disabled={selectedVariantIds.size === 0}
          onClick={handlePrintLabels}
        >
          <Printer className="mr-1.5 h-4 w-4" />
          Print Labels{selectedVariantIds.size > 0 ? ` (${selectedVariantIds.size})` : ''}
        </Button>
      </div>

      <div className="rounded-lg border border-sand/30 bg-pearl overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow className="bg-sand/20 hover:bg-sand/20">
              <TableHead className="w-10">
                <Checkbox
                  checked={variants.length > 0 && selectedVariantIds.size === variants.length}
                  onCheckedChange={toggleAll}
                  aria-label="Select all variants"
                />
              </TableHead>
              <TableHead className="w-10" />
              <TableHead className="font-body text-xs font-semibold uppercase tracking-wider text-espresso/70">
                SKU
              </TableHead>
              <TableHead className="font-body text-xs font-semibold uppercase tracking-wider text-espresso/70">
                Barcode
              </TableHead>
              <TableHead className="font-body text-xs font-semibold uppercase tracking-wider text-espresso/70">
                Size
              </TableHead>
              <TableHead className="font-body text-xs font-semibold uppercase tracking-wider text-espresso/70">
                Colour
              </TableHead>
              {canViewCost && (
                <TableHead className="font-body text-xs font-semibold uppercase tracking-wider text-espresso/70">
                  Cost Price
                </TableHead>
              )}
              <TableHead className="font-body text-xs font-semibold uppercase tracking-wider text-espresso/70">
                Retail Price
              </TableHead>
              <TableHead className="font-body text-xs font-semibold uppercase tracking-wider text-espresso/70">
                Wholesale
              </TableHead>
              <TableHead className="font-body text-xs font-semibold uppercase tracking-wider text-espresso/70">
                Stock
              </TableHead>
              <TableHead className="font-body text-xs font-semibold uppercase tracking-wider text-espresso/70">
                Low Threshold
              </TableHead>
              {(canEdit || canDelete) && (
                <TableHead className="font-body text-xs font-semibold uppercase tracking-wider text-espresso/70 text-right">
                  Actions
                </TableHead>
              )}
            </TableRow>
          </TableHeader>
          <TableBody>
            {variants.map((v) => {
              const isExpanded = expandedId === v.id;
              return (
                <VariantRows
                  key={v.id}
                  variant={v}
                  isExpanded={isExpanded}
                  canViewCost={canViewCost}
                  canEdit={canEdit}
                  canDelete={canDelete}
                  isSelected={selectedVariantIds.has(v.id)}
                  onToggleSelect={() => toggleVariant(v.id)}
                  onToggleExpand={() =>
                    setExpandedId(isExpanded ? null : v.id)
                  }
                  onEdit={() => setEditTarget(v)}
                  onDelete={() => setDeleteTarget(v)}
                />
              );
            })}
          </TableBody>
        </Table>
      </div>

      {/* Variant edit sheet */}
      <VariantEditSheet
        isOpen={!!editTarget}
        onClose={() => setEditTarget(null)}
        variant={editTarget}
        permissions={permissions}
        productId={productId}
      />

      {/* Barcode Label Dialog */}
      {labelDialogOpen && (
        <BarcodeLabelDialog
          isOpen={labelDialogOpen}
          onClose={() => setLabelDialogOpen(false)}
          variants={selectedLabelVariants}
        />
      )}

      {/* Delete confirmation */}
      <Dialog open={!!deleteTarget} onOpenChange={() => setDeleteTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="font-display text-espresso">Delete Variant</DialogTitle>
            <DialogDescription className="font-body text-mist">
              Are you sure you want to delete variant{' '}
              <strong className="text-espresso font-mono">{deleteTarget?.sku}</strong>?
              This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              className="border-sand text-espresso"
              onClick={() => setDeleteTarget(null)}
            >
              Cancel
            </Button>
            <Button
              className="bg-red-600 text-white hover:bg-red-700"
              disabled={deleteMutation.isPending}
              onClick={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}
            >
              {deleteMutation.isPending ? 'Deleting…' : 'Delete Variant'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

// ── Variant row(s) ───────────────────────────────────────────────────────────

interface VariantRowsProps {
  variant: Variant;
  isExpanded: boolean;
  canViewCost: boolean;
  canEdit: boolean;
  canDelete: boolean;
  isSelected: boolean;
  onToggleSelect: () => void;
  onToggleExpand: () => void;
  onEdit: () => void;
  onDelete: () => void;
}

function VariantRows({
  variant,
  isExpanded,
  canViewCost,
  canEdit,
  canDelete,
  isSelected,
  onToggleSelect,
  onToggleExpand,
  onEdit,
  onDelete,
}: VariantRowsProps) {
  const colSpan = 7 + (canViewCost ? 1 : 0) + (canEdit || canDelete ? 1 : 0);

  return (
    <>
      <TableRow className="hover:bg-sand/10">
        <TableCell>
          <Checkbox
            checked={isSelected}
            onCheckedChange={onToggleSelect}
            aria-label={`Select variant ${variant.sku}`}
          />
        </TableCell>
        <TableCell>
          {variant.imageUrls.length > 0 ? (
            <button
              type="button"
              onClick={onToggleExpand}
              className="text-mist hover:text-espresso transition-colors"
            >
              {isExpanded ? (
                <ChevronDown className="h-4 w-4" />
              ) : (
                <ChevronRight className="h-4 w-4" />
              )}
            </button>
          ) : (
            <span className="inline-block h-4 w-4" />
          )}
        </TableCell>
        <TableCell className="font-mono text-sm text-espresso">{variant.sku}</TableCell>
        <TableCell className="font-mono text-sm text-espresso">
          {variant.barcode || '—'}
        </TableCell>
        <TableCell className="font-body text-sm text-espresso">
          {variant.size || '—'}
        </TableCell>
        <TableCell className="font-body text-sm text-espresso">
          {variant.colour || '—'}
        </TableCell>
        {canViewCost && (
          <TableCell className="font-mono text-sm text-espresso">
            {formatPrice(variant.costPrice)}
          </TableCell>
        )}
        <TableCell className="font-mono text-sm text-espresso">
          {formatPrice(variant.retailPrice)}
        </TableCell>
        <TableCell className="font-mono text-sm text-espresso">
          {formatPrice(variant.wholesalePrice)}
        </TableCell>
        <TableCell>
          <StockBadge qty={variant.stockQuantity} threshold={variant.lowStockThreshold} />
        </TableCell>
        <TableCell className="font-body text-sm text-espresso">
          {variant.lowStockThreshold}
        </TableCell>
        {(canEdit || canDelete) && (
          <TableCell className="text-right">
            <div className="flex items-center justify-end gap-1">
              {canEdit && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-mist hover:text-espresso"
                  onClick={onEdit}
                >
                  <Pencil className="h-3.5 w-3.5" />
                </Button>
              )}
              {canDelete && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-mist hover:text-red-600"
                  onClick={onDelete}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              )}
            </div>
          </TableCell>
        )}
      </TableRow>

      {/* Expanded row for images */}
      {isExpanded && variant.imageUrls.length > 0 && (
        <TableRow className="bg-linen/50 hover:bg-linen/50">
          <TableCell colSpan={colSpan} className="py-3">
            <div className="flex flex-wrap gap-2 pl-6">
              {variant.imageUrls.map((url, i) => (
                <Image
                  key={`${variant.id}-img-${i}`}
                  src={url}
                  alt={`${variant.sku} image ${i + 1}`}
                  width={60}
                  height={60}
                  className="h-[60px] w-[60px] rounded-md object-cover border border-sand/30"
                />
              ))}
            </div>
          </TableCell>
        </TableRow>
      )}
    </>
  );
}
