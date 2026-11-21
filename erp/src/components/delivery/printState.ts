/**
 * ARGUS #274 - one row-level print action at a time.
 *
 * The list used no key/state, so double-clicking Print or Invoice could open
 * two print flows and invoice failures were only logged to the console.
 */
export type DeliveryPrintAction = 'waybill' | 'invoice';

export function deliveryPrintKey(action: DeliveryPrintAction, deliveryId: string): string {
  return `${action}:${deliveryId}`;
}

export interface DeliveryPrintButtonState {
  /** This row's button started the active print. */
  isActive: boolean;
  /** Any row print is running, so every print button is disabled. */
  isBusy: boolean;
}

export function deliveryPrintButtonState(
  activeKey: string | null,
  action: DeliveryPrintAction,
  deliveryId: string,
): DeliveryPrintButtonState {
  return {
    isActive: activeKey === deliveryPrintKey(action, deliveryId),
    isBusy: activeKey !== null,
  };
}
