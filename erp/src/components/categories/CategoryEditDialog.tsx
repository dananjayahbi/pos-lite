'use client';

import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';
import type { Category } from '@/hooks/useCategories';
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
import { Textarea } from '@/components/ui/textarea';
import { CategoryImageUpload } from '@/components/categories/CategoryImageUpload';

interface CategoryEditDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  category: Category | null;
}

export function CategoryEditDialog({ open, onOpenChange, category }: CategoryEditDialogProps) {
  const queryClient = useQueryClient();
  const isEdit = !!category;

  // Key the inner form by `open` + `category` so its state resets cleanly each
  // time the dialog is reopened with a different category — no setState-in-effect.
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <CategoryEditForm
          key={`${category?.id ?? 'new'}-${open}`}
          category={category}
          isEdit={isEdit}
          onOpenChange={onOpenChange}
          onSaved={() => {
            queryClient.invalidateQueries({ queryKey: ['categories'] });
            queryClient.invalidateQueries({ queryKey: ['category'] });
            onOpenChange(false);
          }}
        />
      </DialogContent>
    </Dialog>
  );
}

function CategoryEditForm({
  category,
  isEdit,
  onOpenChange,
  onSaved,
}: {
  category: Category | null;
  isEdit: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
}) {
  const [name, setName] = useState(category?.name ?? '');
  const [description, setDescription] = useState(category?.description ?? '');
  const [sortOrder, setSortOrder] = useState<string>(String(category?.sortOrder ?? 0));
  const [imageUrl, setImageUrl] = useState<string | null>(category?.imageUrl ?? null);

  const mutation = useMutation({
    mutationFn: async () => {
      if (isEdit && !category) throw new Error('Category is required');
      const url = isEdit ? `/api/store/categories/${category!.id}` : '/api/store/categories';
      const method = isEdit ? 'PATCH' : 'POST';
      const body: Record<string, unknown> = {
        name: name.trim(),
        sortOrder: Number.parseInt(sortOrder, 10) || 0,
        imageUrl: imageUrl ?? '',
      };
      if (description.trim()) body.description = description.trim();

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error?.message ?? 'Failed to save category');
      }
      return res.json();
    },
    onSuccess: () => {
      toast.success(isEdit ? 'Category updated' : 'Category created');
      onSaved();
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const trimmedName = name.trim();
  const parsedSort = Number.parseInt(sortOrder, 10);
  const isValid =
    trimmedName.length >= 2 &&
    trimmedName.length <= 60 &&
    !Number.isNaN(parsedSort) &&
    parsedSort >= 0;

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (isValid && !mutation.isPending) mutation.mutate();
  }

  return (
    <>
      <DialogHeader>
        <DialogTitle className="font-display text-espresso">
          {isEdit ? 'Edit Category' : 'New Category'}
        </DialogTitle>
        <DialogDescription className="text-mist">
          {isEdit
            ? 'Update the category name, sort order, and description.'
            : 'Create a new category to organize your products.'}
        </DialogDescription>
      </DialogHeader>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="cat-name" className="text-xs text-mist">
            Category Name <span className="text-red-700">*</span>
          </Label>
          <Input
            id="cat-name"
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Hair Care"
            className="bg-pearl"
            maxLength={60}
          />
        </div>

        <div className="space-y-1.5">
          <Label className="text-xs text-mist">Category Image</Label>
          <CategoryImageUpload imageUrl={imageUrl} onChange={setImageUrl} />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="cat-sort" className="text-xs text-mist">
            Sort Order
          </Label>
          <Input
            id="cat-sort"
            type="number"
            min={0}
            value={sortOrder}
            onChange={(e) => setSortOrder(e.target.value)}
            className="bg-pearl"
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="cat-description" className="text-xs text-mist">
            Description
          </Label>
          <Textarea
            id="cat-description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Optional category description"
            className="bg-pearl resize-none"
            rows={3}
          />
        </div>

        <DialogFooter className="-mx-4 -mb-4">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={mutation.isPending}
            className="border-sand text-espresso"
          >
            Cancel
          </Button>
          <Button
            type="submit"
            className="bg-espresso text-pearl hover:bg-espresso/90"
            disabled={!isValid || mutation.isPending}
          >
            {mutation.isPending ? (
              <>
                <Loader2 className="mr-1 h-4 w-4 animate-spin" />
                Saving…
              </>
            ) : (
              'Save'
            )}
          </Button>
        </DialogFooter>
      </form>
    </>
  );
}