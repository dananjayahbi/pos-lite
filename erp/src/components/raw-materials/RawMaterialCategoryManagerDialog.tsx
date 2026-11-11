'use client';

import { useState } from 'react';
import { Pencil, Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  useCreateRawMaterialCategory,
  useDeleteRawMaterialCategory,
  useRawMaterialCategories,
  useUpdateRawMaterialCategory,
  type RawMaterialCategoryItem,
} from '@/hooks/useRawMaterialCategories';

interface RawMaterialCategoryManagerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function RawMaterialCategoryManagerDialog({
  open,
  onOpenChange,
}: RawMaterialCategoryManagerDialogProps) {
  const { data, isLoading } = useRawMaterialCategories();
  const createMutation = useCreateRawMaterialCategory();
  const updateMutation = useUpdateRawMaterialCategory();
  const deleteMutation = useDeleteRawMaterialCategory();

  const [newName, setNewName] = useState('');
  const [editing, setEditing] = useState<RawMaterialCategoryItem | null>(null);
  const [editName, setEditName] = useState('');
  const [error, setError] = useState<string | null>(null);

  const categories = data?.data ?? [];

  const handleCreate = () => {
    const name = newName.trim();
    if (!name) return;
    setError(null);
    createMutation
      .mutateAsync(name)
      .then(() => {
        setNewName('');
        toast.success('Category added');
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
      })
      .catch((err: Error) => setError(err.message));
  };

  const handleDelete = (category: RawMaterialCategoryItem) => {
    setError(null);
    deleteMutation
      .mutateAsync(category.id)
      .then(() => toast.success('Category deleted'))
      .catch((err: Error) => setError(err.message));
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Raw material categories</DialogTitle>
          <DialogDescription>
            Add, rename or remove the categories used to group raw materials.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="flex items-end gap-2">
            <div className="flex-1 space-y-1">
              <Label htmlFor="new-category">New category</Label>
              <Input
                id="new-category"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="e.g. Bottles & Caps"
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

          <div className="max-h-72 divide-y overflow-y-auto rounded-lg border">
            {isLoading ? (
              <p className="px-3 py-4 text-sm text-mist-ink">Loading categories…</p>
            ) : categories.length === 0 ? (
              <p className="px-3 py-4 text-sm text-mist-ink">No categories yet.</p>
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
                        <p className="truncate text-sm text-espresso">{category.name}</p>
                        <p className="text-xs text-mist-ink">
                          {category.usageCount} material{category.usageCount === 1 ? '' : 's'}
                        </p>
                      </div>
                      <Button
                        type="button"
                        size="icon"
                        variant="ghost"
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
                            ? 'Remove materials from this category first'
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

          {error ? <p className="text-sm text-red-600">{error}</p> : null}
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
