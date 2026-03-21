'use client';

import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import type { Category } from '@/hooks/useCategories';
import { Badge } from '@/components/ui/badge';
import { ChevronRight, Pencil, Trash2 } from 'lucide-react';
import { Input } from '@/components/ui/input';

interface CategoryTreeProps {
  categories: Category[];
  canEdit: boolean;
  canDelete: boolean;
}

export function CategoryTree({ categories, canEdit, canDelete }: CategoryTreeProps) {
  const queryClient = useQueryClient();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const updateMutation = useMutation({
    mutationFn: async ({ id, name }: { id: string; name: string }) => {
      const res = await fetch(`/api/store/categories/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.error?.message ?? 'Failed to update category');
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['categories'] });
      setEditingId(null);
      toast.success('Category updated');
    },
    onError: (err: Error) => toast.error(err.message),
  });

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
      toast.success('Category deleted');
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const roots = categories.filter((c) => !c.parentId);
  const childrenMap = new Map<string, Category[]>();
  for (const c of categories) {
    if (c.parentId) {
      const arr = childrenMap.get(c.parentId) ?? [];
      arr.push(c);
      childrenMap.set(c.parentId, arr);
    }
  }

  function toggleExpand(id: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function startEdit(cat: Category) {
    setEditingId(cat.id);
    setEditName(cat.name);
  }

  function handleEditKeyDown(e: React.KeyboardEvent, id: string) {
    if (e.key === 'Enter') {
      const trimmed = editName.trim();
      if (trimmed.length >= 2 && trimmed.length <= 50) {
        updateMutation.mutate({ id, name: trimmed });
      }
    }
    if (e.key === 'Escape') {
      setEditingId(null);
    }
  }

  function renderRow(cat: Category, depth: number) {
    const children = childrenMap.get(cat.id) ?? [];
    const hasChildren = children.length > 0;
    const isExpanded = expanded.has(cat.id);
    const isEditing = editingId === cat.id;

    return (
      <div key={cat.id}>
        <div
          className="group flex items-center gap-2 rounded px-2 py-1.5 hover:bg-sand/50"
          style={{ paddingLeft: `${depth * 24 + 8}px` }}
        >
          {/* Chevron */}
          <button
            type="button"
            className={`flex h-5 w-5 items-center justify-center transition-transform ${hasChildren ? 'text-mist' : 'invisible'} ${isExpanded ? 'rotate-90' : ''}`}
            onClick={() => toggleExpand(cat.id)}
            tabIndex={-1}
            aria-label={isExpanded ? `Collapse ${cat.name}` : `Expand ${cat.name}`}
          >
            <ChevronRight className="h-4 w-4" />
          </button>

          {/* Name or edit input */}
          {isEditing ? (
            <Input
              autoFocus
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              onKeyDown={(e) => handleEditKeyDown(e, cat.id)}
              onBlur={() => setEditingId(null)}
              className="h-7 w-48 text-sm"
            />
          ) : (
            <span className="font-body text-sm text-espresso">{cat.name}</span>
          )}

          {/* Product count badge */}
          <Badge variant="secondary" className="ml-auto bg-sand text-espresso text-xs">
            {cat._count.products}
          </Badge>

          {/* Actions */}
          {!isEditing && (
            <div className="flex gap-1 opacity-0 transition-opacity group-hover:opacity-100">
              {canEdit && (
                <button
                  type="button"
                  className="rounded p-1 text-mist hover:text-espresso"
                  onClick={() => startEdit(cat)}
                  aria-label={`Edit ${cat.name}`}
                >
                  <Pencil className="h-3.5 w-3.5" />
                </button>
              )}
              {canDelete && cat._count.products === 0 && (
                <button
                  type="button"
                  className="rounded p-1 text-mist hover:text-terracotta"
                  onClick={() => deleteMutation.mutate(cat.id)}
                  aria-label={`Delete ${cat.name}`}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          )}
        </div>

        {/* Children */}
        {hasChildren && isExpanded && children.map((child) => renderRow(child, depth + 1))}
      </div>
    );
  }

  if (categories.length === 0) {
    return (
      <div className="rounded-lg border border-sand bg-pearl p-8 text-center text-sm text-mist">
        No categories yet. Create your first category above.
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-sand bg-pearl p-2">
      {roots.map((cat) => renderRow(cat, 0))}
    </div>
  );
}
