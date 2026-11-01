'use client';

import { useState } from 'react';
import { Pencil, Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  useCreatePackagingCategory,
  useDeletePackagingCategory,
  usePackagingCategories,
  useUpdatePackagingCategory,
  type PackagingCategoryItem,
} from '@/hooks/delivery/usePackaging';

interface PackagingCategoryEditorProps {
  /** Called after a category is created, renamed or deleted. */
  onChanged?: () => void;
}

/**
 * Inline category manager used both inside the Add/Edit item dialog (so a new
 * category can be created without leaving the form) and in the page-level
 * "Categories" dialog.
 */
export function PackagingCategoryEditor({ onChanged }: PackagingCategoryEditorProps) {
  const { data, isLoading } = usePackagingCategories();
  const createMutation = useCreatePackagingCategory();
  const updateMutation = useUpdatePackagingCategory();
  const deleteMutation = useDeletePackagingCategory();

  const [newName, setNewName] = useState('');
  const [editing, setEditing] = useState<PackagingCategoryItem | null>(null);
  const [editName, setEditName] = useState('');
  const [error, setError] = useState<string | null>(null);

  const categories = data ?? [];

  const handleCreate = () => {
    const name = newName.trim();
    if (!name) return;
    setError(null);
    createMutation
      .mutateAsync(name)
      .then((created) => {
        setNewName('');
        toast.success(`Category “${created?.name ?? name}” added`);
        onChanged?.();
      })
      .catch((err: Error) => setError(err.message));
  };

  const handleRename = () => {
    if (!editing) return;
    const name = editName.trim();
    if (!name) return;
    setError(null);
    updateMutation
      .mutateAsync({ id: editing.id, name })
      .then(() => {
        setEditing(null);
        toast.success('Category renamed');
        onChanged?.();
      })
      .catch((err: Error) => setError(err.message));
  };

  const handleDelete = (category: PackagingCategoryItem) => {
    setError(null);
    deleteMutation
      .mutateAsync(category.id)
      .then(() => {
        toast.success('Category deleted');
        onChanged?.();
      })
      .catch((err: Error) => setError(err.message));
  };

  return (
    <div className="space-y-3">
      <div className="flex items-end gap-2">
        <div className="flex-1 space-y-1">
          <Label htmlFor="new-packaging-category">New category</Label>
          <Input
            id="new-packaging-category"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="e.g. Courier Bags"
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                handleCreate();
              }
            }}
          />
        </div>
        <Button
          type="button"
          onClick={handleCreate}
          disabled={createMutation.isPending || !newName.trim()}
        >
          <Plus className="mr-1 h-4 w-4" /> Add
        </Button>
      </div>

      <div className="border-espresso/10 max-h-56 divide-y overflow-y-auto rounded-lg border">
        {isLoading ? (
          <p className="text-espresso/50 px-3 py-4 text-sm">Loading categories…</p>
        ) : categories.length === 0 ? (
          <p className="text-espresso/50 px-3 py-4 text-sm">No categories yet.</p>
        ) : (
          categories.map((category) => (
            <div key={category.id} className="flex items-center gap-2 px-3 py-2">
              {editing?.id === category.id ? (
                <>
                  <Input
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleRename();
                      }
                    }}
                    autoFocus
                  />
                  <Button type="button" size="sm" onClick={handleRename}>
                    Save
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => setEditing(null)}
                  >
                    Cancel
                  </Button>
                </>
              ) : (
                <>
                  <div className="min-w-0 flex-1">
                    <p className="text-espresso truncate text-sm">{category.name}</p>
                    <p className="text-espresso/50 text-xs">
                      {category.usageCount} item{category.usageCount === 1 ? '' : 's'}
                    </p>
                  </div>
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    title="Rename category"
                    onClick={() => {
                      setEditing(category);
                      setEditName(category.name);
                    }}
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    className="text-red-600"
                    disabled={deleteMutation.isPending}
                    onClick={() => handleDelete(category)}
                    title={
                      category.usageCount > 0
                        ? 'Move items to another category before deleting'
                        : 'Delete category'
                    }
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </>
              )}
            </div>
          ))
        )}
      </div>

      {error ? <p className="text-terracotta text-sm">{error}</p> : null}
    </div>
  );
}
