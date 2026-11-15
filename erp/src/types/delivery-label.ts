/** Shared types for the custom shipping-label designer. */

export type LabelHeaderLayout = 'left' | 'centered';

export type LabelPageSize = 'a6' | 'a4' | 'thermal';

/** Per-tenant shipping-label template. Persisted under `Tenant.settings.delivery.label`. */
export interface DeliveryLabelTemplate {
  brandName: string;
  logoUrl: string | null;
  accentColor: string;
  borderColor: string;
  headerLayout: LabelHeaderLayout;
  pageSize: LabelPageSize;
  /** Sender contact shown in the Proof of Delivery block. */
  fromContact: string;
  /** Company address printed under the company name in the footer. */
  footerAddress: string;
  /** Direct line printed beside the footer address. */
  footerPhone: string;
  showBarcodes: boolean;
  showOrderRef: boolean;
  showCod: boolean;
  showItemCount: boolean;
  showWeight: boolean;
  showOrigin: boolean;
  showPickupAddress: boolean;
  footerNote: string;
}
