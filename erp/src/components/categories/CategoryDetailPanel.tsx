'use client';

import { useQuery } from '@tanstack/react-query';
import type { Category } from '@/hooks/useCategories';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Pencil, Package, CalendarClock, Hash } from 'lucide-react';

interface CategoryDetailPanelProps {
  category: Category;
  onEdit: () => void;
  onDelete: () => void;
  canEdit: boolean;
  canDelete: boolean;
}

interface CategoryDetail extends Category {
  description: string | null;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

export function CategoryDetailPanel({
  category,
  onEdit,
  onDelete,
  canEdit,
  canDelete,
}: CategoryDetailPanelProps) {
  const { data, isLoading, isError } = useQuery<{ success: boolean; data: CategoryDetail }>({
    queryKey: ['category', category.id],
    queryFn: async () => {
      const res = await fetch(`/api/store/categories/${category.id}`);
      if (!res.ok) throw new Error('Failed to fetch category details');
      return res.json();
    },
    enabled: !!category.id,
    staleTime: 60_000,
  });

  const detail = data?.data ?? null;

  const formatDate = (iso: string) => {
    try {
      return new Date(iso).toLocaleString(undefined, {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return iso;
    }
  };

  return (
    <div className="flex h-full flex-col rounded-lg border border-sand bg-linen">
      {/* Header */}
      <div className="flex items-start justify-between gap-2 border-b border-sand bg-pearl p-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h2 className="truncate font-display text-lg font-semibold text-espresso">
              {category.name}
            </h2>
            <Badge variant="secondary" className="bg-sand text-espresso text-xs">
              {category._count.products} product{category._count.products === 1 ? '' : 's'}
            </Badge>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          {canEdit && (
            <Button
              size="sm"
              variant="outline"
              onClick={onEdit}
              className="h-8 border-sand text-espresso hover:bg-sand"
            >
              <Pencil className="mr-1 h-3.5 w-3.5" />
              Edit
            </Button>
          )}
          {canDelete && (
            <Button
              size="sm"
              variant="outline"
              onClick={onDelete}
              className="h-8 border-sand text-red-700 hover:bg-red-50"
            >
              Delete
            </Button>
          )}
        </div>
      </div>

      {/* Body */}
      <div className="flex-1 space-y-4 overflow-y-auto p-4">
        {isLoading && (
          <div className="space-y-2">
            <div className="h-4 w-1/2 animate-pulse rounded bg-sand" />
            <div className="h-4 w-2/3 animate-pulse rounded bg-sand" />
            <div className="h-4 w-1/3 animate-pulse rounded bg-sand" />
          </div>
        )}

        {isError && (
          <p className="text-sm text-red-700">Failed to load category details.</p>
        )}

        {detail && (
          <>
            <DetailRow
              icon={<Hash className="h-3.5 w-3.5" />}
              label="ID"
              value={<span className="font-mono text-xs">{detail.id}</span>}
            />
            <DetailRow
              icon={<Hash className="h-3.5 w-3.5" />}
              label="Sort Order"
              value={String(detail.sortOrder)}
            />
            <DetailRow
              icon={<Package className="h-3.5 w-3.5" />}
              label="Products"
              value={`${detail._count.products} assigned`}
            />
            <DetailRow
              icon={<CalendarClock className="h-3.5 w-3.5" />}
              label="Created"
              value={formatDate(detail.createdAt)}
            />
            <DetailRow
              icon={<CalendarClock className="h-3.5 w-3.5" />}
              label="Updated"
              value={formatDate(detail.updatedAt)}
            />

            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-mist">Description</p>
              <p className="mt-1 text-sm text-espresso">
                {detail.description?.trim() ? detail.description : (
                  <span className="italic text-mist">No description provided</span>
                )}
              </p>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function DetailRow({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div className="flex items-start gap-2">
      <span className="mt-0.5 text-mist">{icon}</span>
      <div className="min-w-0 flex-1">
        <p className="text-xs font-medium uppercase tracking-wide text-mist">{label}</p>
        <p className="text-sm text-espresso">{value}</p>
      </div>
    </div>
  );
}