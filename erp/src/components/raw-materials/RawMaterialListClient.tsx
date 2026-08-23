'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Plus } from 'lucide-react';
import { toast } from 'sonner';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
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
import { PERMISSIONS } from '@/lib/constants/permissions';
import { RawMaterialTable } from '@/components/raw-materials/RawMaterialTable';
import { RawMaterialFormDialog } from '@/components/raw-materials/RawMaterialFormDialog';
import { RawMaterialAdjustDialog } from '@/components/raw-materials/RawMaterialAdjustDialog';
import { useRawMaterials } from '@/hooks/useRawMaterials';
import type { RawMaterialItem } from '@/hooks/useRawMaterials';
import type { RawMaterialCategory } from '@/generated/prisma/client';
import type { RawMaterialStockStatus } from '@/lib/services/rawMaterial.core';
import {
  RAW_MATERIAL_CATEGORIES,
  getRawMaterialCategoryLabel,
} from '@/lib/services/rawMaterial.core';

interface RawMaterialListClientProps {
  permissions: string[];
}

export function RawMaterialListClient({ permissions }: RawMaterialListClientProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();

  const page = Number(searchParams.get('page') ?? '1');
  const limit = 25;
  const search = searchParams.get('search') ?? undefined;
  const categoryRaw = searchParams.get('category');
  const category = (RAW_MATERIAL_CATEGORIES as string[]).includes(categoryRaw ?? '')
    ? (categoryRaw as RawMaterialCategory)
    : undefined;
  const stockStatusRaw = searchParams.get('stockStatus');
  const stockStatus: RawMaterialStockStatus | undefined =
    stockStatusRaw === 'OK' || stockStatusRaw === 'LOW' || stockStatusRaw === 'OUT'
      ? stockStatusRaw
      : undefined;

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<RawMaterialItem | null>(null);
  const [adjustTarget, setAdjustTarget] = useState<RawMaterialItem | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<RawMaterialItem | null>(null);

  const [searchInput, setSearchInput] = useState(search ?? '');

  useEffect(() => {
    setSearchInput(search ?? '');
  }, [search]);

  useEffect(() => {
    const timer = setTimeout(() => {
      updateParams({ search: searchInput || null, page: '1' });
    }, 350);
    return () => clearTimeout(timer);
  }, [searchInput]);

  const canCreate = permissions.includes(PERMISSIONS.RAW_MATERIAL.createRawMaterial);
  const canEdit = permissions.includes(PERMISSIONS.RAW_MATERIAL.editRawMaterial);
  const canDelete = permissions.includes(PERMISSIONS.RAW_MATERIAL.deleteRawMaterial);
  const canAdjust = permissions.includes(PERMISSIONS.RAW_MATERIAL.adjustRawMaterialStock);

  const filters = useMemo(
    () => ({ search, category, stockStatus, page, limit }),
    [search, category, stockStatus, page],
  );

  const { data, isLoading } = useRawMaterials(filters);
  const materials = data?.data ?? [];
  const total = data?.meta?.total ?? 0;
  const totalPages = data?.meta?.totalPages ?? 1;

  const updateParams = useCallback(
    (updates: Record<string, string | null>) => {
      const params = new URLSearchParams(searchParams.toString());
      for (const [key, value] of Object.entries(updates)) {
        if (value === null) params.delete(key);
        else params.set(key, value);
      }
      router.push(`/factory/raw-materials?${params.toString()}`);
    },
    [router, searchParams],
  );

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/store/raw-materials/${id}`, { method: 'DELETE' });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error?.message ?? 'Request failed');
      return json;
    },
    onSuccess: () => {
      toast.success('Raw material deleted');
      queryClient.invalidateQueries({ queryKey: ['raw-materials'] });
      queryClient.invalidateQueries({ queryKey: ['raw-material-stats'] });
      setDeleteTarget(null);
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const showFrom = (page - 1) * limit + 1;
  const showTo = Math.min(page * limit, total);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold text-espresso">Raw Materials</h1>
          <p className="mt-1 font-body text-sm text-mist">
            Track bulk ingredients (oils, powders, chemicals) by liter or kilogram.
          </p>
        </div>
        {canCreate && (
          <Button
            onClick={() => {
              setEditing(null);
              setFormOpen(true);
            }}
          >
            <Plus className="mr-2 h-4 w-4" /> Add raw material
          </Button>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="w-full max-w-xs">
          <Input
            placeholder="Search materials…"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
          />
        </div>
        <Select
          value={category ?? 'all'}
          onValueChange={(value) => updateParams({ category: value === 'all' ? null : value, page: '1' })}
        >
          <SelectTrigger className="w-44">
            <SelectValue placeholder="All categories" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All categories</SelectItem>
            {RAW_MATERIAL_CATEGORIES.map((cat) => (
              <SelectItem key={cat} value={cat}>
                {getRawMaterialCategoryLabel(cat)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select
          value={stockStatus ?? 'all'}
          onValueChange={(value) => updateParams({ stockStatus: value === 'all' ? null : value, page: '1' })}
        >
          <SelectTrigger className="w-40">
            <SelectValue placeholder="All statuses" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            <SelectItem value="OK">In stock</SelectItem>
            <SelectItem value="LOW">Low stock</SelectItem>
            <SelectItem value="OUT">Out of stock</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="rounded-lg border bg-white shadow-sm">
        <RawMaterialTable
          materials={materials}
          isLoading={isLoading}
          canEdit={canEdit}
          canDelete={canDelete}
          canAdjust={canAdjust}
          onEdit={(m) => {
            setEditing(m);
            setFormOpen(true);
          }}
          onDelete={(m) => setDeleteTarget(m)}
          onAdjust={(m) => setAdjustTarget(m)}
        />

        {total > 0 && (
          <div className="flex items-center justify-between border-t px-4 py-3 text-sm text-mist">
            <span>
              Showing {showFrom}–{showTo} of {total}
            </span>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={page <= 1}
                onClick={() => updateParams({ page: String(page - 1) })}
              >
                Previous
              </Button>
              <span>
                Page {page} of {totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                disabled={page >= totalPages}
                onClick={() => updateParams({ page: String(page + 1) })}
              >
                Next
              </Button>
            </div>
          </div>
        )}
      </div>

      <RawMaterialFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        material={editing}
      />
      <RawMaterialAdjustDialog
        open={adjustTarget !== null}
        onOpenChange={(open) => !open && setAdjustTarget(null)}
        material={adjustTarget}
      />

      <Dialog open={deleteTarget !== null} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Delete raw material</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete{' '}
              <span className="font-medium text-espresso">{deleteTarget?.name}</span>? This
              cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              disabled={deleteMutation.isPending}
              onClick={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}
            >
              {deleteMutation.isPending ? 'Deleting…' : 'Delete'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
