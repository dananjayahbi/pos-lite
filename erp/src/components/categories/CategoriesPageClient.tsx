'use client';

import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { useCategories } from '@/hooks/useCategories';
import { CategoryList } from '@/components/categories/CategoryList';
import { CategoryDetailPanel } from '@/components/categories/CategoryDetailPanel';
import { CategoryEditDialog } from '@/components/categories/CategoryEditDialog';
import { DeleteConfirmDialog } from '@/components/shared/DeleteConfirmDialog';
import { PageSkeleton } from '@/components/skeletons';
import { Button } from '@/components/ui/button';
import { Plus } from 'lucide-react';

interface CategoriesPageClientProps {
  permissions: string[];
}

export function CategoriesPageClient({ permissions }: CategoriesPageClientProps) {
  const [view, setView] = useState<'active' | 'deleted'>('active');
  const { data, isLoading, isError } = useCategories(view === 'deleted');
  const queryClient = useQueryClient();
  const [createOpen, setCreateOpen] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editTargetId, setEditTargetId] = useState<string | null>(null);
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);

  const categories = data?.data ?? [];
  const canEdit = permissions.includes('product:edit');
  const canDelete = permissions.includes('product:delete');

  const selectedCategory = categories.find((c) => c.id === selectedId) ?? null;
  const editTarget = categories.find((c) => c.id === editTargetId) ?? null;
  const deleteTarget = categories.find((c) => c.id === deleteTargetId) ?? null;

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/store/categories/${id}`, { method: 'DELETE' });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.error?.message ?? 'Failed to delete category');
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['categories'] });
      queryClient.invalidateQueries({ queryKey: ['category'] });
      toast.success('Category deleted');
      if (deleteTargetId === selectedId) setSelectedId(null);
      setDeleteTargetId(null);
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const restoreMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/store/categories/${id}/restore`, { method: 'POST' });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.error?.message ?? 'Failed to restore category');
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['categories'] });
      toast.success('Category restored');
    },
    onError: (err: Error) => toast.error(err.message),
  });

  function switchView(next: 'active' | 'deleted') {
    setView(next);
    setSelectedId(null);
    setCreateOpen(false);
    setEditTargetId(null);
  }

  if (isLoading) {
    return <PageSkeleton caption="Select a category to see details" />;
  }

  if (isError) {
    return (
      <div className="p-6">
        <div className="rounded-lg border border-red-200 bg-red-50 p-6 text-sm text-red-700">
          Failed to load categories. Please refresh the page.
        </div>
      </div>
    );
  }

  return (
    <div className="flex gap-6 p-6">
      {/* Left panel */}
      <div className="w-3/5 space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h1 className="font-display text-2xl font-semibold text-espresso">Categories</h1>
            <p className="text-sm text-mist-ink">
              {categories.length}{' '}
              {view === 'deleted'
                ? categories.length === 1
                  ? 'deleted category'
                  : 'deleted categories'
                : categories.length === 1
                  ? 'category'
                  : 'categories'}
            </p>
          </div>
          {view === 'active' && (
            <Button
              size="sm"
              className="bg-espresso text-pearl hover:bg-espresso/90"
              onClick={() => {
                setEditTargetId(null);
                setCreateOpen(true);
              }}
            >
              <Plus className="mr-1 h-4 w-4" />
              New Category
            </Button>
          )}
        </div>

        {/* ARGUS #172: soft-deleted categories are recoverable, not lost. */}
        <div className="flex items-center gap-1" role="group" aria-label="Category view">
          <Button
            size="sm"
            variant={view === 'active' ? 'secondary' : 'ghost'}
            aria-pressed={view === 'active'}
            onClick={() => switchView('active')}
          >
            Active
          </Button>
          <Button
            size="sm"
            variant={view === 'deleted' ? 'secondary' : 'ghost'}
            aria-pressed={view === 'deleted'}
            onClick={() => switchView('deleted')}
          >
            Deleted
          </Button>
        </div>

        <CategoryList
          categories={categories}
          canEdit={canEdit}
          canDelete={canDelete}
          selectedId={view === 'active' ? selectedId : null}
          onSelect={view === 'active' ? (c) => setSelectedId(c.id) : undefined}
          onEdit={view === 'active' ? (c) => setEditTargetId(c.id) : undefined}
          onDelete={view === 'active' ? (c) => setDeleteTargetId(c.id) : undefined}
          onRestore={canDelete ? (c) => restoreMutation.mutate(c.id) : undefined}
        />
      </div>

      {/* Right panel */}
      <div className="w-2/5">
        {view === 'deleted' ? (
          <div className="flex h-full min-h-75 items-center justify-center rounded-lg border border-sand bg-linen p-8 text-center">
            <p className="max-w-xs text-sm text-mist-ink">
              Deleted categories are hidden from products and the storefront. Use
              Restore to bring one back.
            </p>
          </div>
        ) : selectedCategory ? (
          <CategoryDetailPanel
            category={selectedCategory}
            canEdit={canEdit}
            canDelete={canDelete}
            onEdit={() => setEditTargetId(selectedCategory.id)}
            onDelete={() => setDeleteTargetId(selectedCategory.id)}
          />
        ) : (
          <div className="flex h-full min-h-75 items-center justify-center rounded-lg border border-sand bg-linen p-8">
            <p className="text-sm text-mist-ink">Select a category to see details</p>
          </div>
        )}
      </div>

      {/* Create / edit dialog: both modes render the full field set. */}
      <CategoryEditDialog
        open={createOpen || !!editTarget}
        onOpenChange={(open) => {
          if (!open) {
            setCreateOpen(false);
            setEditTargetId(null);
          }
        }}
        category={editTarget}
      />

      {/* Delete confirmation */}
      <DeleteConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTargetId(null)}
        title="Delete Category"
        description={
          deleteTarget
            ? `Are you sure you want to delete "${deleteTarget.name}"? It will be hidden from products and the storefront; you can restore it from the Deleted view.`
            : ''
        }
        pending={deleteMutation.isPending}
        onConfirm={() => {
          if (deleteTarget) deleteMutation.mutate(deleteTarget.id);
        }}
        confirmLabel="Delete Category"
      />
    </div>
  );
}
