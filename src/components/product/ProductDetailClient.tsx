'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft,
  Pencil,
  Trash2,
  Archive,
  ArchiveRestore,
  ChevronRight,
} from 'lucide-react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { standardSchemaResolver } from '@hookform/resolvers/standard-schema';
import { z } from 'zod';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet';
import { ProductStatusBadge } from '@/components/inventory/ProductStatusBadge';
import { ProductDetailsCard } from '@/components/product/ProductDetailsCard';
import { VariantsTab } from '@/components/product/VariantsTab';
import { StockHistoryTab } from '@/components/product/StockHistoryTab';
import { TagInput } from '@/components/product/TagInput';
import { useProduct } from '@/hooks/useProduct';
import { useCategories } from '@/hooks/useCategories';
import { useBrands } from '@/hooks/useBrands';

// ── Types ────────────────────────────────────────────────────────────────────

interface ProductDetailClientProps {
  productId: string;
  permissions: string[];
}

// ── Edit schema ──────────────────────────────────────────────────────────────

const editProductSchema = z.object({
  name: z
    .string()
    .min(2, 'Product name must be at least 2 characters')
    .max(120, 'Product name must be at most 120 characters'),
  description: z.string().max(1000, 'Description must be at most 1000 characters'),
  categoryId: z.string().min(1, 'Category is required'),
  brandId: z.string(),
  gender: z.enum(['MEN', 'WOMEN', 'UNISEX', 'KIDS', 'TODDLERS']),
  tags: z.array(z.string()).max(20, 'Maximum 20 tags'),
  taxRule: z.enum(['STANDARD_VAT', 'SSCL', 'EXEMPT']),
});

type EditProductFormData = z.infer<typeof editProductSchema>;

// ── Tabs ─────────────────────────────────────────────────────────────────────

const TABS = [
  { key: 'details', label: 'Details' },
  { key: 'variants', label: 'Variants' },
  { key: 'stock-history', label: 'Stock History' },
] as const;

type TabKey = (typeof TABS)[number]['key'];

// ── Gender display ───────────────────────────────────────────────────────────

const GENDER_LABELS: Record<string, string> = {
  MEN: 'Men',
  WOMEN: 'Women',
  UNISEX: 'Unisex',
  KIDS: 'Kids',
  TODDLERS: 'Toddlers',
};

// ── Component ────────────────────────────────────────────────────────────────

export function ProductDetailClient({ productId, permissions }: ProductDetailClientProps) {
  const router = useRouter();
  const queryClient = useQueryClient();

  const { data: product, isLoading, error } = useProduct(productId);

  const [activeTab, setActiveTab] = useState<TabKey>('details');
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteConfirmName, setDeleteConfirmName] = useState('');

  const canEdit = permissions.includes('product:edit');
  const canDelete = permissions.includes('product:delete');
  const canArchive = permissions.includes('product:archive');

  // ── Archive mutation ─────────────────────────────────────────────────────

  const archiveMutation = useMutation({
    mutationFn: async (archive: boolean) => {
      const res = await fetch(`/api/store/products/${productId}/archive`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isArchived: archive }),
      });
      if (!res.ok) throw new Error('Failed to update archive status');
      return res.json();
    },
    onSuccess: (_data, archive) => {
      toast.success(archive ? 'Product archived' : 'Product restored');
      queryClient.invalidateQueries({ queryKey: ['product', productId] });
      queryClient.invalidateQueries({ queryKey: ['products'] });
    },
    onError: () => {
      toast.error('Failed to update archive status');
    },
  });

  // ── Delete mutation ──────────────────────────────────────────────────────

  const deleteMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/store/products/${productId}`, {
        method: 'DELETE',
      });
      if (!res.ok) throw new Error('Failed to delete product');
      return res.json();
    },
    onSuccess: () => {
      toast.success('Product deleted');
      queryClient.invalidateQueries({ queryKey: ['products'] });
      router.push('/inventory');
    },
    onError: () => {
      toast.error('Failed to delete product');
    },
  });

  // ── Loading state ────────────────────────────────────────────────────────

  if (isLoading) {
    return (
      <div className="space-y-6 p-6 md:p-8">
        <div className="flex items-center gap-2 text-sm text-mist">
          <Skeleton className="h-4 w-16" />
          <Skeleton className="h-4 w-32" />
        </div>
        <Skeleton className="h-8 w-64" />
        <div className="flex gap-2">
          <Skeleton className="h-6 w-20 rounded-full" />
          <Skeleton className="h-6 w-16 rounded-full" />
        </div>
        <div className="flex gap-2">
          {TABS.map((t) => (
            <Skeleton key={t.key} className="h-9 w-24 rounded-lg" />
          ))}
        </div>
        <Skeleton className="h-64 w-full rounded-lg" />
      </div>
    );
  }

  // ── Error state ──────────────────────────────────────────────────────────

  if (error || !product) {
    return (
      <div className="flex flex-col items-center justify-center py-20 p-6 md:p-8">
        <p className="font-body text-lg text-espresso">Product not found</p>
        <Button asChild variant="outline" className="mt-4 border-sand text-espresso">
          <Link href="/inventory">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Inventory
          </Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6 md:p-8">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-1 text-sm font-body">
        <Link href="/inventory" className="text-mist hover:text-espresso transition-colors">
          Inventory
        </Link>
        <ChevronRight className="h-4 w-4 text-mist" />
        <span className="text-espresso font-medium truncate max-w-[200px]">{product.name}</span>
      </nav>

      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-2">
          <h1 className="font-display text-2xl font-semibold text-espresso sm:text-3xl">
            {product.name}
          </h1>
          <div className="flex flex-wrap items-center gap-2">
            {product.category && (
              <span className="inline-flex items-center rounded-full bg-sand/20 px-2.5 py-0.5 text-xs font-medium text-espresso">
                {product.category.name}
              </span>
            )}
            {product.brand && (
              <span className="inline-flex items-center rounded-full bg-mist/20 px-2.5 py-0.5 text-xs font-medium text-espresso">
                {product.brand.name}
              </span>
            )}
            {product.gender && (
              <span className="inline-flex items-center rounded-full bg-linen px-2.5 py-0.5 text-xs font-medium text-espresso">
                {GENDER_LABELS[product.gender] ?? product.gender}
              </span>
            )}
            <ProductStatusBadge
              isArchived={product.isArchived}
              variants={product.variants ?? []}
            />
          </div>
        </div>

        {/* Actions */}
        <div className="flex flex-wrap items-center gap-2">
          {canArchive && (
            <Button
              variant="outline"
              size="sm"
              className="border-sand text-espresso"
              onClick={() => archiveMutation.mutate(!product.isArchived)}
              disabled={archiveMutation.isPending}
            >
              {product.isArchived ? (
                <>
                  <ArchiveRestore className="mr-1.5 h-4 w-4" />
                  Restore
                </>
              ) : (
                <>
                  <Archive className="mr-1.5 h-4 w-4" />
                  Archive
                </>
              )}
            </Button>
          )}
          {canEdit && (
            <Button
              variant="outline"
              size="sm"
              className="border-sand text-espresso"
              onClick={() => setEditOpen(true)}
            >
              <Pencil className="mr-1.5 h-4 w-4" />
              Edit
            </Button>
          )}
          {canDelete && (
            <Button
              variant="outline"
              size="sm"
              className="border-red-300 text-red-700 hover:bg-red-50"
              onClick={() => {
                setDeleteConfirmName('');
                setDeleteOpen(true);
              }}
            >
              <Trash2 className="mr-1.5 h-4 w-4" />
              Delete
            </Button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-sand/30">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            type="button"
            className={`px-4 py-2.5 text-sm font-body font-medium transition-colors relative ${
              activeTab === tab.key
                ? 'text-espresso'
                : 'text-mist hover:text-espresso'
            }`}
            onClick={() => setActiveTab(tab.key)}
          >
            {tab.label}
            {activeTab === tab.key && (
              <span className="absolute inset-x-0 -bottom-px h-0.5 bg-espresso rounded-full" />
            )}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {activeTab === 'details' && <ProductDetailsCard product={product} variants={product.variants ?? []} />}
      {activeTab === 'variants' && (
        <VariantsTab
          productId={productId}
          variants={product.variants ?? []}
          permissions={permissions}
          productName={product.name ?? ''}
          brandName={product.brand?.name ?? null}
        />
      )}
      {activeTab === 'stock-history' && (
        <StockHistoryTab productId={productId} />
      )}

      {/* Edit Sheet */}
      {canEdit && (
        <EditProductSheet
          open={editOpen}
          onOpenChange={setEditOpen}
          product={product}
          productId={productId}
        />
      )}

      {/* Delete Dialog */}
      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="font-display text-espresso">Delete Product</DialogTitle>
            <DialogDescription className="font-body text-mist">
              This action cannot be undone. Type <strong className="text-espresso">{product.name}</strong> to confirm.
            </DialogDescription>
          </DialogHeader>
          <Input
            value={deleteConfirmName}
            onChange={(e) => setDeleteConfirmName(e.target.value)}
            placeholder="Type product name to confirm"
            className="border-sand"
          />
          <DialogFooter>
            <Button
              variant="outline"
              className="border-sand text-espresso"
              onClick={() => setDeleteOpen(false)}
            >
              Cancel
            </Button>
            <Button
              className="bg-red-600 text-white hover:bg-red-700"
              disabled={deleteConfirmName !== product.name || deleteMutation.isPending}
              onClick={() => deleteMutation.mutate()}
            >
              {deleteMutation.isPending ? 'Deleting…' : 'Delete Product'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ── Edit Product Sheet ───────────────────────────────────────────────────────

interface EditProductSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  product: Record<string, unknown>;
  productId: string;
}

function EditProductSheet({ open, onOpenChange, product, productId }: EditProductSheetProps) {
  const queryClient = useQueryClient();
  const { data: categoriesData } = useCategories();
  const { data: brandsData } = useBrands();

  const categories = categoriesData?.data ?? [];
  const brands = brandsData?.data ?? [];

  const form = useForm<EditProductFormData>({
    resolver: standardSchemaResolver(editProductSchema),
    values: {
      name: (product.name as string) ?? '',
      description: (product.description as string) ?? '',
      categoryId: (product.categoryId as string) ?? '',
      brandId: (product.brandId as string) ?? '',
      gender: (product.gender as EditProductFormData['gender']) ?? 'UNISEX',
      tags: (product.tags as string[]) ?? [],
      taxRule: (product.taxRule as EditProductFormData['taxRule']) ?? 'STANDARD_VAT',
    },
  });

  const updateMutation = useMutation({
    mutationFn: async (data: EditProductFormData) => {
      const res = await fetch(`/api/store/products/${productId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const json = await res.json().catch(() => null);
        throw new Error(json?.error?.message || 'Failed to update product');
      }
      return res.json();
    },
    onSuccess: () => {
      toast.success('Product updated');
      queryClient.invalidateQueries({ queryKey: ['product', productId] });
      queryClient.invalidateQueries({ queryKey: ['products'] });
      onOpenChange(false);
    },
    onError: (err: Error) => {
      toast.error(err.message);
    },
  });

  const onSubmit = form.handleSubmit((data) => updateMutation.mutate(data));

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-lg overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="font-display text-espresso">Edit Product</SheetTitle>
          <SheetDescription className="font-body text-mist">
            Update product information
          </SheetDescription>
        </SheetHeader>

        <form onSubmit={onSubmit} className="space-y-5 p-4">
          {/* Name */}
          <div className="space-y-1.5">
            <Label htmlFor="edit-name" className="font-body text-sm text-espresso">
              Name
            </Label>
            <Input
              id="edit-name"
              {...form.register('name')}
              className="border-sand"
            />
            {form.formState.errors.name && (
              <p className="text-xs text-red-600">{form.formState.errors.name.message}</p>
            )}
          </div>

          {/* Description */}
          <div className="space-y-1.5">
            <Label htmlFor="edit-desc" className="font-body text-sm text-espresso">
              Description
            </Label>
            <Textarea
              id="edit-desc"
              {...form.register('description')}
              rows={3}
              className="border-sand"
            />
            {form.formState.errors.description && (
              <p className="text-xs text-red-600">{form.formState.errors.description.message}</p>
            )}
          </div>

          {/* Category */}
          <div className="space-y-1.5">
            <Label className="font-body text-sm text-espresso">Category</Label>
            <Select
              value={form.watch('categoryId')}
              onValueChange={(v) => form.setValue('categoryId', v, { shouldValidate: true })}
            >
              <SelectTrigger className="border-sand">
                <SelectValue placeholder="Select category" />
              </SelectTrigger>
              <SelectContent>
                {categories.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {form.formState.errors.categoryId && (
              <p className="text-xs text-red-600">{form.formState.errors.categoryId.message}</p>
            )}
          </div>

          {/* Brand */}
          <div className="space-y-1.5">
            <Label className="font-body text-sm text-espresso">Brand</Label>
            <Select
              value={form.watch('brandId') || '__none__'}
              onValueChange={(v) =>
                form.setValue('brandId', v === '__none__' ? '' : v, { shouldValidate: true })
              }
            >
              <SelectTrigger className="border-sand">
                <SelectValue placeholder="Select brand (optional)" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">No brand</SelectItem>
                {brands.map((b) => (
                  <SelectItem key={b.id} value={b.id}>
                    {b.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Gender */}
          <div className="space-y-1.5">
            <Label className="font-body text-sm text-espresso">Gender</Label>
            <Select
              value={form.watch('gender')}
              onValueChange={(v) =>
                form.setValue('gender', v as EditProductFormData['gender'], { shouldValidate: true })
              }
            >
              <SelectTrigger className="border-sand">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="MEN">Men</SelectItem>
                <SelectItem value="WOMEN">Women</SelectItem>
                <SelectItem value="UNISEX">Unisex</SelectItem>
                <SelectItem value="KIDS">Kids</SelectItem>
                <SelectItem value="TODDLERS">Toddlers</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Tax Rule */}
          <div className="space-y-1.5">
            <Label className="font-body text-sm text-espresso">Tax Rule</Label>
            <Select
              value={form.watch('taxRule')}
              onValueChange={(v) =>
                form.setValue('taxRule', v as EditProductFormData['taxRule'], { shouldValidate: true })
              }
            >
              <SelectTrigger className="border-sand">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="STANDARD_VAT">Standard VAT (15%)</SelectItem>
                <SelectItem value="SSCL">SSCL</SelectItem>
                <SelectItem value="EXEMPT">VAT Exempt</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Tags */}
          <div className="space-y-1.5">
            <Label className="font-body text-sm text-espresso">Tags</Label>
            <TagInput
              value={form.watch('tags')}
              onChange={(tags) => form.setValue('tags', tags, { shouldValidate: true })}
            />
            {form.formState.errors.tags && (
              <p className="text-xs text-red-600">{form.formState.errors.tags.message}</p>
            )}
          </div>

          {/* Submit */}
          <div className="flex justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              className="border-sand text-espresso"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              className="bg-espresso text-pearl hover:bg-espresso/90"
              disabled={updateMutation.isPending}
            >
              {updateMutation.isPending ? 'Saving…' : 'Save Changes'}
            </Button>
          </div>
        </form>
      </SheetContent>
    </Sheet>
  );
}
