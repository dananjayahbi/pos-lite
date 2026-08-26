'use client';

import { useEffect, useState } from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { useLabelTemplate } from '@/hooks/delivery';
import { DEFAULT_LABEL_TEMPLATE } from '@/lib/constants/label';
import { LabelTemplateForm } from '@/components/delivery/labels/LabelTemplateForm';
import { LabelPreview } from '@/components/delivery/labels/LabelPreview';
import type { DeliveryLabelTemplate } from '@/types/delivery-label';

export function LabelDesignerClient() {
  const { data, isLoading, save, reset } = useLabelTemplate();
  const [template, setTemplate] = useState<DeliveryLabelTemplate>(DEFAULT_LABEL_TEMPLATE);
  const [hydrated, setHydrated] = useState(false);

  // Hydrate local editor state once the saved template loads (never clobber edits).
  useEffect(() => {
    if (!data || hydrated) return;
    setHydrated(true);
    setTemplate(data);
  }, [data, hydrated]);

  const patch = (next: Partial<DeliveryLabelTemplate>) =>
    setTemplate((current) => ({ ...current, ...next }));

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-64" />
        <div className="grid gap-6 lg:grid-cols-2">
          <Skeleton className="h-96 w-full" />
          <Skeleton className="h-96 w-full" />
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="font-display text-2xl font-bold text-espresso">Label Design</h1>
        <p className="mt-1 text-sm text-sand">
          Customize how shipping labels render when a delivery is printed.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <LabelTemplateForm
          template={template}
          onChange={patch}
          onSave={() =>
            save.mutate(template, {
              onSuccess: (saved) => setTemplate(saved),
            })
          }
          onReset={() =>
            reset.mutate(undefined, {
              onSuccess: (saved) => setTemplate(saved),
            })
          }
          isSaving={save.isPending}
          isResetting={reset.isPending}
        />
        <LabelPreview template={template} />
      </div>
    </div>
  );
}
