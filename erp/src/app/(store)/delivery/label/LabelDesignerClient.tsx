'use client';

import { useState } from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { useLabelTemplate } from '@/hooks/delivery';
import { DEFAULT_LABEL_TEMPLATE } from '@/lib/constants/label';
import { LabelTemplateForm } from '@/components/delivery/labels/LabelTemplateForm';
import { LabelPreview } from '@/components/delivery/labels/LabelPreview';
import type { DeliveryLabelTemplate } from '@/types/delivery-label';

export function LabelDesignerClient() {
  const { data, isLoading, save, reset } = useLabelTemplate();
  // `null` means "no local edits yet": the saved template is rendered directly.
  // Editing copies it into a draft, so no effect has to hydrate state later.
  const [draft, setDraft] = useState<DeliveryLabelTemplate | null>(null);
  const template = draft ?? data ?? DEFAULT_LABEL_TEMPLATE;

  const patch = (next: Partial<DeliveryLabelTemplate>) =>
    setDraft({ ...template, ...next });

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
        <h1 className="font-display text-2xl font-bold text-espresso">Waybill Design</h1>
        <p className="mt-1 text-sm text-sand-ink">
          Fixed TransExpress Proof of Delivery design, printed two per A4 landscape sheet.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <LabelTemplateForm
          template={template}
          onChange={patch}
          onSave={() =>
            save.mutate(template, {
              onSuccess: (saved) => setDraft(saved),
            })
          }
          onReset={() =>
            reset.mutate(undefined, {
              onSuccess: (saved) => setDraft(saved),
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
