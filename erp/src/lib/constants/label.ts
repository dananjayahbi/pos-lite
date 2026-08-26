import type {
  DeliveryLabelTemplate,
  LabelHeaderLayout,
  LabelPageSize,
} from '@/types/delivery-label';

/** Allowed header layouts. Kept as a client-safe const array (no Prisma import). */
export const LABEL_HEADER_LAYOUTS: LabelHeaderLayout[] = ['left', 'centered'];

/** Allowed print page sizes. */
export const LABEL_PAGE_SIZES: LabelPageSize[] = ['a6', 'a4', 'thermal'];

/** Human-readable labels for the page-size selector. */
export const LABEL_PAGE_SIZE_LABELS: Record<LabelPageSize, string> = {
  a6: 'A6',
  a4: 'A4',
  thermal: 'Thermal (80mm)',
};

/** Preset accent colors from the design palette. */
export const LABEL_COLOR_SWATCHES = [
  { name: 'Espresso', value: '#3A2D28' },
  { name: 'Terracotta', value: '#C25E3C' },
  { name: 'Forest', value: '#2F5D50' },
  { name: 'Navy', value: '#1E3A5F' },
  { name: 'Plum', value: '#5D3A6B' },
  { name: 'Slate', value: '#475569' },
] as const;

/** Print-window size hint (px) per page size. */
export const LABEL_WINDOW_SIZE: Record<LabelPageSize, { width: number; height: number }> = {
  a6: { width: 430, height: 640 },
  a4: { width: 794, height: 1123 },
  thermal: { width: 430, height: 600 },
};

/**
 * Fallback template. An empty brandName/logoUrl signals the renderer to use the
 * tenant's branding (resolved server-side in `label.service.ts`).
 */
export const DEFAULT_LABEL_TEMPLATE: DeliveryLabelTemplate = {
  brandName: '',
  logoUrl: null,
  accentColor: '#3A2D28',
  borderColor: '#3A2D28',
  headerLayout: 'left',
  pageSize: 'a6',
  showBarcodes: true,
  showOrderRef: true,
  showCod: true,
  showItemCount: true,
  showWeight: true,
  showOrigin: true,
  showPickupAddress: true,
  footerNote: '',
};
