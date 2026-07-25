'use client';

import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { useCategories } from '@/hooks/useCategories';
import { CategoryList } from '@/components/categories/CategoryList';
import { CategoryDetailPanel } from '@/components/categories/CategoryDetailPanel';
import { CategoryEditDialog } from '@/components/categories/CategoryEditDialog';
import { InlineCategoryForm } from '@/components/categories/InlineCategoryForm';
import { DeleteConfirmDialog } from '@/components/shared/DeleteConfirmDialog';
import { PageSkeleton } from '@/components/skeletons';
import { Button } from '@/components/ui/button';
import { Plus } from 'lucide-react';

interface CategoriesPageClientProps {
  permissions: string[];
}

export function CategoriesPageClient({ permissions }: CategoriesPageClientProps) {
  const { data, isLoading, isError } = useCategories();
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
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
        <div className="flex items-center justify-between">
          <div>
            <h1 className="font-display text-2xl font-semibold text-espresso">Categories</h1>
            <p className="text-sm text-mist">
              {categories.length} {categories.length === 1 ? 'category' : 'categories'}
            </p>
          </div>
          <Button
            size="sm"
            className="bg-espresso text-pearl hover:bg-espresso/90"
            onClick={() => setShowForm(true)}
          >
            <Plus className="mr-1 h-4 w-4" />
            New Category
          </Button>
        </div>

        {showForm && <InlineCategoryForm onClose={() => setShowForm(false)} />}

        <CategoryList
          categories={categories}
          canEdit={canEdit}
          canDelete={canDelete}
          selectedId={selectedId}
          onSelect={(c) => setSelectedId(c.id)}
          onEdit={(c) => setEditTargetId(c.id)}
          onDelete={(c) => setDeleteTargetId(c.id)}
        />
      </div>

      {/* Right panel */}
      <div className="w-2/5">
        {selectedCategory ? (
          <CategoryDetailPanel
            category={selectedCategory}
            canEdit={canEdit}
            canDelete={canDelete}
            onEdit={() => setEditTargetId(selectedCategory.id)}
            onDelete={() => setDeleteTargetId(selectedCategory.id)}
          />
        ) : (
          <div className="flex h-full min-h-75 items-center justify-center rounded-lg border border-sand bg-linen p-8">
            <p className="text-sm text-mist">Select a category to see details</p>
          </div>
        )}
      </div>

      {/* Edit dialog */}
      <CategoryEditDialog
        open={!!editTarget}
        onOpenChange={(open) => !open && setEditTargetId(null)}
        category={editTarget}
      />

      {/* Delete confirmation */}
      <DeleteConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTargetId(null)}
        title="Delete Category"
        description={
          deleteTarget
            ? `Are you sure you want to delete "${deleteTarget.name}"? This action cannot be undone.`
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
