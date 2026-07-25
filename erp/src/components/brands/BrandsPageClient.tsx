'use client';

import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { useBrands } from '@/hooks/useBrands';
import type { Brand } from '@/hooks/useBrands';
import { BrandList } from '@/components/brands/BrandList';
import { BrandDetailPanel } from '@/components/brands/BrandDetailPanel';
import { BrandEditDialog } from '@/components/brands/BrandEditDialog';
import { DeleteConfirmDialog } from '@/components/shared/DeleteConfirmDialog';
import { PageSkeleton } from '@/components/skeletons';
import { Button } from '@/components/ui/button';
import { Plus } from 'lucide-react';

interface BrandsPageClientProps {
  permissions: string[];
}

export function BrandsPageClient({ permissions }: BrandsPageClientProps) {
  const { data, isLoading, isError } = useBrands();
  const queryClient = useQueryClient();
  const [sheetOpen, setSheetOpen] = useState(false);
  const [editingBrand, setEditingBrand] = useState<Brand | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);

  const brands = data?.data ?? [];
  const canEdit = permissions.includes('product:edit');
  const canDelete = permissions.includes('product:delete');

  const selectedBrand = brands.find((b) => b.id === selectedId) ?? null;
  const deleteTarget = brands.find((b) => b.id === deleteTargetId) ?? null;

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/store/brands/${id}`, { method: 'DELETE' });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.error?.message ?? 'Failed to delete brand');
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['brands'] });
      queryClient.invalidateQueries({ queryKey: ['brand'] });
      toast.success('Brand deleted');
      if (deleteTargetId === selectedId) setSelectedId(null);
      setDeleteTargetId(null);
    },
    onError: (err: Error) => toast.error(err.message),
  });

  function openCreate() {
    setEditingBrand(null);
    setSheetOpen(true);
  }

  function openEdit(brand: Brand) {
    setEditingBrand(brand);
    setSheetOpen(true);
  }

  if (isLoading) {
    return <PageSkeleton caption="Select a brand to see details" />;
  }

  if (isError) {
    return (
      <div className="p-6">
        <div className="rounded-lg border border-red-200 bg-red-50 p-6 text-sm text-red-700">
          Failed to load brands. Please refresh the page.
        </div>
      </div>
    );
  }

  return (
    <div className="flex gap-6 p-6">
      {/* Left panel */}
      <div className="w-3/5 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="font-display text-2xl font-semibold text-espresso">Brands</h1>
            <p className="text-sm text-mist">
              {brands.length} {brands.length === 1 ? 'brand' : 'brands'}
            </p>
          </div>
          <Button
            size="sm"
            className="bg-espresso text-pearl hover:bg-espresso/90"
            onClick={openCreate}
          >
            <Plus className="mr-1 h-4 w-4" />
            New Brand
          </Button>
        </div>

        <BrandList
          brands={brands}
          canEdit={canEdit}
          canDelete={canDelete}
          selectedId={selectedId}
          onSelect={(b) => setSelectedId(b.id)}
          onEdit={openEdit}
          onDelete={(b) => setDeleteTargetId(b.id)}
        />
      </div>

      {/* Right panel */}
      <div className="w-2/5">
        {selectedBrand ? (
          <BrandDetailPanel
            brand={selectedBrand}
            canEdit={canEdit}
            canDelete={canDelete}
            onEdit={() => openEdit(selectedBrand)}
            onDelete={() => setDeleteTargetId(selectedBrand.id)}
          />
        ) : (
          <div className="flex h-full min-h-75 items-center justify-center rounded-lg border border-sand bg-linen p-8">
            <p className="text-sm text-mist">Select a brand to see details</p>
          </div>
        )}
      </div>

      <BrandEditDialog
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        brand={editingBrand}
      />

      {/* Delete confirmation */}
      <DeleteConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTargetId(null)}
        title="Delete Brand"
        description={
          deleteTarget
            ? `Are you sure you want to delete "${deleteTarget.name}"? This action cannot be undone.`
            : ''
        }
        pending={deleteMutation.isPending}
        onConfirm={() => {
          if (deleteTarget) deleteMutation.mutate(deleteTarget.id);
        }}
        confirmLabel="Delete Brand"
      />
    </div>
  );
}
