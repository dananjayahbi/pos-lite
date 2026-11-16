'use client';

import { Clock3, Pencil, Trash2 } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { formatRupee } from '@/lib/format';

interface ServiceCardProps {
  name: string;
  description?: string | null | undefined;
  durationMins: number;
  price: number;
  color?: string | null | undefined;
  isActive: boolean;
  canManage: boolean;
  onEdit: () => void;
  onDelete: () => void;
}

export function ServiceCard({
  name,
  description,
  durationMins,
  price,
  color,
  isActive,
  canManage,
  onEdit,
  onDelete,
}: ServiceCardProps) {
  const swatch = color ?? '#A48374';

  return (
    <article className="flex h-full flex-col justify-between rounded-xl border border-mist/70 bg-white p-5 shadow-sm transition-shadow hover:shadow-md">
      <div>
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-start gap-3">
            <span
              aria-hidden
              className="mt-1.5 h-3.5 w-3.5 shrink-0 rounded-full ring-2 ring-white"
              style={{ backgroundColor: swatch }}
            />
            <div className="min-w-0">
              <h3 className="truncate font-display text-base font-semibold text-espresso" title={name}>
                {name}
              </h3>
              <p className="mt-1 line-clamp-2 min-h-[2.5rem] text-sm text-mist-ink">
                {description || 'No description added.'}
              </p>
            </div>
          </div>
          <Badge
            variant={isActive ? 'success' : 'secondary'}
            className="shrink-0"
          >
            {isActive ? 'Active' : 'Inactive'}
          </Badge>
        </div>

        <dl className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 border-t border-mist/50 pt-3 text-sm">
          <div className="flex items-center gap-1.5 text-espresso">
            <Clock3 className="h-4 w-4 text-sand-ink" aria-hidden />
            <dt className="sr-only">Duration</dt>
            <dd>{durationMins} min</dd>
          </div>
          <div className="flex items-center gap-1.5">
            <dt className="sr-only">Price</dt>
            <dd className="font-mono font-semibold text-espresso">{formatRupee(price)}</dd>
          </div>
        </dl>
      </div>

      {canManage ? (
        <div className="mt-4 flex items-center justify-end gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="border-mist text-espresso hover:border-sand"
            onClick={onEdit}
          >
            <Pencil className="mr-1.5 h-3.5 w-3.5" />
            Edit
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="border-mist text-red-600 hover:border-red-200 hover:bg-red-50 hover:text-red-700"
            onClick={onDelete}
            aria-label={`Delete ${name}`}
          >
            <Trash2 className="mr-1.5 h-3.5 w-3.5" />
            Delete
          </Button>
        </div>
      ) : null}
    </article>
  );
}
