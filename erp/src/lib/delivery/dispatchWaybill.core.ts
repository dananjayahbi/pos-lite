/**
 * ARGUS #278 - the Dispatch sheet printed a courier-looking waybill while the
 * delivery was still PENDING_DISPATCH/AUTO. The auto waybill only exists after
 * Dispatch, so the sheet must say it is a pre-dispatch preview.
 */

export type DispatchWaybillActionKind = 'print' | 'preview';

export interface DispatchWaybillAction {
  kind: DispatchWaybillActionKind;
  /** Button text. */
  label: string;
  /** Why the label is only a preview (null when a real waybill exists). */
  hint: string | null;
}

export function dispatchWaybillAction(
  waybillId: string | null | undefined,
): DispatchWaybillAction {
  if (waybillId && waybillId.trim() !== '') {
    return { kind: 'print', label: 'Waybill', hint: null };
  }
  return {
    kind: 'preview',
    label: 'Preview waybill (draft)',
    hint: 'No courier waybill exists yet. Dispatch issues it; until then the label prints as a Draft with no barcode.',
  };
}
