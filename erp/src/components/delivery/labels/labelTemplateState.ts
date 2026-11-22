import type { DeliveryLabelTemplate, LabelBranding, LabelTemplateMeta } from '@/types/delivery-label';
import { resolveWaybillSender } from '@/lib/delivery/sender';
import { formatShortDateTime } from '@/lib/format';
import { staffDisplayName } from '@/lib/utils/staff-name';

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
  template?: Pick<DeliveryLabelTemplate, 'brandName' | 'fromContact'> | null,
): boolean {
  return (
    state === 'ready' &&
    Boolean(template?.brandName?.trim()) &&
    Boolean(template?.fromContact?.trim())
  );
}

/**
 * Merge the business profile with the legacy label template (ARGUS #301).
 *
 * The Store Profile is authoritative: a stale saved `brandName`/`fromContact`
 * must not print as the sender. The template argument is only used when the
 * caller has no business branding at all (for example an older endpoint
 * response without `meta.branding`).
 */
export function resolveLabelTemplate(
  template: Partial<DeliveryLabelTemplate> | null | undefined,
  branding: Partial<LabelBranding> | null | undefined,
): DeliveryLabelTemplate {
  const source = branding
    ? {
        name: branding.name,
        contact: branding.phoneNumber,
        pickupAddress: branding.address,
      }
    : {
        name: template?.brandName,
        contact: template?.fromContact,
        pickupAddress: template?.pickupAddress,
      };
  const sender = resolveWaybillSender(source);
  return {
    brandName: sender.name,
    fromContact: sender.contact,
    pickupAddress: sender.pickupAddress,
  };
}

/** Human message for an error card; never empty, never leaks a stack. */
export function labelTemplateErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message.trim() !== '') return error.message;
  return fallback;
}

/**
 * ARGUS #305: the designer must say who last changed the waybill setup and
 * when. A reset is worth stating explicitly because it discards the saved
 * overrides.
 */
export function labelTemplateProvenance(meta: LabelTemplateMeta | null | undefined): string {
  if (!meta?.updatedAt) {
    return 'Using the Store Profile defaults; no template override has been saved.';
  }
  const action = meta.action === 'reset' ? 'Reset to Store Profile defaults' : 'Saved';
  const who = meta.updatedByEmail
    ? `${staffDisplayName(meta.updatedByEmail)}${meta.updatedByRole ? ` (${meta.updatedByRole.replace(/_/g, ' ').toLowerCase()})` : ''}`
    : 'an unknown user';
  return `${action} ${formatShortDateTime(meta.updatedAt)} by ${who}.`;
}
