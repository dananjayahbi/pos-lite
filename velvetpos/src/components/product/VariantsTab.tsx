'use client';

import { useState } from 'react';
import Image from 'next/image';
import { Pencil, Trash2, Package, Printer, Plus } from 'lucide-react';
import { ImageViewerModal } from '@/components/product/ImageViewerModal';
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
import { VariantCreateSheet } from '@/components/product/VariantCreateSheet';
import { BarcodeLabelDialog, type LabelVariant } from '@/components/inventory/BarcodeLabelDialog';
import { COLOUR_CATALOGUE } from '@/components/wizard/ColourPickerModal';
import { formatRupee } from '@/lib/format';

// ── Colour helper (hex or name → CSS colour) ─────────────────────────────────

function resolveColourHex(value: string | null | undefined): string {
  if (!value) return '';
  // Already a hex value
  if (value.startsWith('#')) return value;
  // Legacy name stored — look up in catalogue
  const found = COLOUR_CATALOGUE.find(
    (c) => c.name.toLowerCase() === value.toLowerCase()
  );
  return found?.hex ?? value;
}

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
  return formatRupee(num);
}

// ── Component ────────────────────────────────────────────────────────────────

export function VariantsTab({ productId, variants, permissions, productName, brandName }: VariantsTabProps) {
  const queryClient = useQueryClient();
  const [deleteTarget, setDeleteTarget] = useState<Variant | null>(null);
  const [editTarget, setEditTarget] = useState<Variant | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [selectedVariantIds, setSelectedVariantIds] = useState<Set<string>>(new Set());
  const [labelDialogOpen, setLabelDialogOpen] = useState(false);
  const [viewerImages, setViewerImages] = useState<string[]>([]);
  const [viewerIndex, setViewerIndex] = useState(0);
  const [viewerOpen, setViewerOpen] = useState(false);

  function openViewer(images: string[], startIndex: number) {
    setViewerImages(images);
    setViewerIndex(startIndex);
    setViewerOpen(true);
  }

  const canViewCost = permissions.includes('product:view_cost_price');
  const canEdit = permissions.includes('product:edit');
  const canDelete = permissions.includes('product:delete');
  const canCreate = permissions.includes('product:create');

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
      <div className="mb-3 flex items-center justify-between gap-2">
        {canCreate ? (
          <Button onClick={() => setCreateOpen(true)}>
            <Plus className="mr-1.5 h-4 w-4" />
            Add Variant
          </Button>
        ) : (
          <span />
        )}

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
              return (
                <VariantRows
                  key={v.id}
                  variant={v}
                  canViewCost={canViewCost}
                  canEdit={canEdit}
                  canDelete={canDelete}
                  isSelected={selectedVariantIds.has(v.id)}
                  onToggleSelect={() => toggleVariant(v.id)}
                  onOpenViewer={(idx) => openViewer(v.imageUrls, idx)}
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

      <VariantCreateSheet
        isOpen={createOpen}
        onClose={() => setCreateOpen(false)}
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

      {/* Image viewer */}
      <ImageViewerModal
        open={viewerOpen}
        onClose={() => setViewerOpen(false)}
        images={viewerImages}
        currentIndex={viewerIndex}
        onIndexChange={setViewerIndex}
      />
    </>
  );
}

// ── Variant row(s) ───────────────────────────────────────────────────────────

interface VariantRowsProps {
  variant: Variant;
  canViewCost: boolean;
  canEdit: boolean;
  canDelete: boolean;
  isSelected: boolean;
  onToggleSelect: () => void;
  onOpenViewer: (startIndex: number) => void;
  onEdit: () => void;
  onDelete: () => void;
}

function VariantRows({
  variant,
  canViewCost,
  canEdit,
  canDelete,
  isSelected,
  onToggleSelect,
  onOpenViewer,
  onEdit,
  onDelete,
}: VariantRowsProps) {
  const MAX_VISIBLE = 3;
  const images = variant.imageUrls;

  return (
    <TableRow className="hover:bg-sand/10">
      <TableCell>
        <Checkbox
          checked={isSelected}
          onCheckedChange={onToggleSelect}
          aria-label={`Select variant ${variant.sku}`}
        />
      </TableCell>
      {/* Inline image thumbnails */}
      <TableCell>
        {images.length > 0 ? (
          <div className="flex items-center gap-1 flex-nowrap">
            {images.slice(0, MAX_VISIBLE).map((url, i) => (
              <button
                key={`${variant.id}-thumb-${i}`}
                type="button"
                className={`relative flex-shrink-0 h-8 w-8 overflow-hidden rounded border transition-opacity hover:opacity-80 focus:outline-none focus-visible:ring-1 focus-visible:ring-terracotta ${
                  i === 0 ? 'border-terracotta ring-1 ring-terracotta/40' : 'border-sand/40'
                }`}
                onClick={() => onOpenViewer(i)}
                aria-label={`View image ${i + 1}`}
              >
                <Image
                  src={url}
                  alt={`${variant.sku} image ${i + 1}`}
                  fill
                  className="object-cover"
                  unoptimized
                />
              </button>
            ))}
            {images.length > MAX_VISIBLE && (
              <button
                type="button"
                className="inline-flex h-8 w-8 items-center justify-center rounded border border-sand/40 bg-linen text-xs font-medium text-espresso hover:bg-sand/20 transition-colors"
                onClick={() => onOpenViewer(MAX_VISIBLE)}
                aria-label={`View all ${images.length} images`}
              >
                +{images.length - MAX_VISIBLE}
              </button>
            )}
          </div>
        ) : (
          <span className="text-xs text-mist italic">—</span>
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
        {variant.colour ? (
          <span className="inline-flex items-center gap-1.5">
            <span
              className="inline-block h-3 w-3 rounded-full border border-espresso/20 shrink-0"
              style={{ backgroundColor: resolveColourHex(variant.colour) }}
              aria-hidden="true"
            />
            {variant.colour}
          </span>
        ) : '—'}
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
                aria-label={`Delete variant ${variant.sku}`}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            )}
          </div>
        </TableCell>
      )}
    </TableRow>
  );
}
