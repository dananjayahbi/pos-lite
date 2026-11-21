import type { DeliveryLabelTemplate, LabelBranding } from '@/types/delivery-label';

/**
 * ARGUS #298 — waybill template loading and sender fallback.
 *
 * A failed template request used to be indistinguishable from "no saved
 * template": the designer rendered blank fields with Save enabled, and every
 * Print button fell back to the default template, printing From "-" and
 * Contact "-". These pure rules are shared by the designer and every print
 * surface so loading, failure and a legitimate empty template are handled
 * explicitly.
 */
export type LabelTemplateViewState = 'error' | 'loading' | 'missing' | 'ready';

export interface LabelTemplateViewInput {
  /** The template request failed (non-2xx, network error or rejected envelope). */
  isError: boolean;
  /** First load in flight. */
  isLoading: boolean;
  /** A template object was returned (the API always returns defaults). */
  hasTemplate: boolean;
}

export function resolveLabelTemplateViewState(
  input: LabelTemplateViewInput,
): LabelTemplateViewState {
  // Error outranks loading and every data-dependent state: a failed read must
  // never fall through to a blank-but-editable designer or an empty print.
  if (input.isError) return 'error';
  if (input.isLoading) return 'loading';
  if (!input.hasTemplate) return 'missing';
  return 'ready';
}

/**
 * Printing requires a successfully loaded template **and** a resolved sender
 * identity; a blank name would print an anonymous waybill.
 */
export function canPrintWaybill(
  state: LabelTemplateViewState,
  template?: Pick<DeliveryLabelTemplate, 'brandName'> | null,
): boolean {
  return state === 'ready' && Boolean(template?.brandName?.trim());
}

/**
 * Merge the saved/default template with tenant branding. Explicit sender
 * values win; empty ones fall back to the store name and contact number, so a
 * template with no saved identity still prints a real sender instead of "-".
 */
export function resolveLabelTemplate(
  template: Partial<DeliveryLabelTemplate> | null | undefined,
  branding: Partial<LabelBranding> | null | undefined,
): DeliveryLabelTemplate {
  return {
    brandName: template?.brandName?.trim() || branding?.name?.trim() || '',
    fromContact: template?.fromContact?.trim() || branding?.phoneNumber?.trim() || '',
  };
}

/** Human message for an error card; never empty, never leaks a stack. */
export function labelTemplateErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message.trim() !== '') return error.message;
  return fallback;
}
