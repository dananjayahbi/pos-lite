'use client';

import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import type { Category } from '@/hooks/useCategories';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface InlineCategoryFormProps {
  categories: Category[];
  onClose: () => void;
}

export function InlineCategoryForm({ categories, onClose }: InlineCategoryFormProps) {
  const queryClient = useQueryClient();
  const [name, setName] = useState('');
  const [parentId, setParentId] = useState('');

  const createMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch('/api/store/categories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          ...(parentId && { parentId }),
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.error?.message ?? 'Failed to create category');
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['categories'] });
      toast.success('Category created');
      onClose();
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const trimmed = name.trim();
  const isValid = trimmed.length >= 2 && trimmed.length <= 50;

  return (
    <div className="rounded-lg border border-sand bg-linen p-4 space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label className="text-xs text-mist">Parent Category</Label>
          <Select value={parentId || ''} onValueChange={setParentId}>
            <SelectTrigger className="h-9 bg-pearl">
              <SelectValue placeholder="None (top level)" />
            </SelectTrigger>
            <SelectContent>
              {categories
                .filter((c) => !c.parentId)
                .map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name}
                  </SelectItem>
                ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs text-mist">Category Name</Label>
          <Input
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Dresses"
            className="h-9 bg-pearl"
            onKeyDown={(e) => {
              if (e.key === 'Enter' && isValid) createMutation.mutate();
              if (e.key === 'Escape') onClose();
            }}
          />
        </div>
      </div>
      <div className="flex justify-end gap-2">
        <Button variant="outline" size="sm" onClick={onClose}>
          Cancel
        </Button>
        <Button
          size="sm"
          className="bg-espresso text-pearl hover:bg-espresso/90"
          disabled={!isValid || createMutation.isPending}
          onClick={() => createMutation.mutate()}
        >
          {createMutation.isPending ? 'Saving…' : 'Save'}
        </Button>
      </div>
    </div>
  );
}
