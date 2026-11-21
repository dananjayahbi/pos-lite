'use client';

import { useState } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useLabelTemplate } from '@/hooks/delivery';
import { LabelTemplateForm } from '@/components/delivery/labels/LabelTemplateForm';
import { LabelPreview } from '@/components/delivery/labels/LabelPreview';
import {
  labelTemplateErrorMessage,
  resolveLabelTemplate,
  resolveLabelTemplateViewState,
} from '@/components/delivery/labels/labelTemplateState';
import type { DeliveryLabelTemplate } from '@/types/delivery-label';

export function LabelDesignerClient() {
  const {
    data,
    branding,
    saved,
    isLoading,
    isError,
    error,
    isFetching,
    refetch,
    save,
    reset,
  } = useLabelTemplate();
  // `null` means "no local edits yet": the saved template is rendered directly.
  // Editing copies it into a draft, so no effect has to hydrate state later.
  const [draft, setDraft] = useState<DeliveryLabelTemplate | null>(null);

  const viewState = resolveLabelTemplateViewState({
    isError,
    isLoading,
    hasTemplate: Boolean(data),
  });
  const template = draft ?? resolveLabelTemplate(data, branding);

  const patch = (next: Partial<DeliveryLabelTemplate>) =>
    setDraft({ ...template, ...next });

  if (viewState === 'loading') {
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

  // ARGUS #298 — a failed read must never render a blank, save-enabled form
  // (saving it would overwrite the real sender identity).
  if (viewState !== 'ready') {
    return (
      <div>
        <div className="mb-6">
          <h1 className="font-display text-2xl font-bold text-espresso">Waybill Design</h1>
        </div>
        <div
          role="alert"
          className="flex flex-col items-center gap-3 rounded-lg border border-red-200 bg-red-50 px-6 py-16 text-center"
        >
          <AlertTriangle className="h-12 w-12 text-red-500" />
          <p className="font-display text-lg font-medium text-red-800">
            Waybill template failed to load
          </p>
          <p className="font-body max-w-md text-sm text-red-600">
            {labelTemplateErrorMessage(
              error,
              'The waybill template could not be loaded. Printing and saving are disabled until it loads.',
            )}
          </p>
          <p className="font-body text-xs text-red-600">
            The saved sender details are safe; retry before editing them.
          </p>
          <Button
            variant="outline"
            size="sm"
            className="border-red-200 bg-white text-red-700 hover:bg-red-100"
            onClick={() => refetch()}
            disabled={isFetching}
          >
            <RefreshCw className={`mr-2 h-4 w-4 ${isFetching ? 'animate-spin' : ''}`} />
            {isFetching ? 'Retrying…' : 'Retry'}
          </Button>
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
          saved={saved}
          onChange={patch}
          onSave={() =>
            save.mutate(template, {
              onSuccess: (savedTemplate) => setDraft(savedTemplate),
            })
          }
          onReset={() =>
            reset.mutate(undefined, {
              onSuccess: (savedTemplate) => setDraft(savedTemplate),
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
