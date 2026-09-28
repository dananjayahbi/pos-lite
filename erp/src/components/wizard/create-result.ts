/**
 * BUG-2 (M02-02): response classification for POST /api/store/products.
 *
 * The route legitimately answers **HTTP 207** with
 * `{ success: true, data, warning: { code: 'PARTIAL_SUCCESS', message } }`
 * when the product row is saved but variant creation fails. A naive
 * `if (!json.success) throw` check treats that as full success, so the
 * wizard toasted "Product created successfully" over a product with zero
 * variants. This helper separates the three honest outcomes so the wizard
 * can surface the warning instead of a success toast.
 */

export interface ProductCreateResponseJson {
  success?: boolean;
  data?: { id?: string } & Record<string, unknown>;
  error?: { code?: string; message?: string };
  warning?: { code?: string; message?: string };
}

export type ProductCreateOutcome =
  | { kind: 'success' }
  | { kind: 'partial'; message: string; productId?: string | undefined }
  | { kind: 'failure'; message: string };

/** Fallback used only when the 207 body omits the warning message. */
export const PARTIAL_SUCCESS_FALLBACK_MESSAGE =
  'Product was created but its variants could not be saved.';

export function classifyProductCreateResponse(
  status: number,
  json: ProductCreateResponseJson | null,
): ProductCreateOutcome {
  const isPartial = status === 207 || json?.warning?.code === 'PARTIAL_SUCCESS';
  if (isPartial) {
    return {
      kind: 'partial',
      message: json?.warning?.message ?? PARTIAL_SUCCESS_FALLBACK_MESSAGE,
      productId: typeof json?.data?.id === 'string' ? json.data.id : undefined,
    };
  }
  if (!json?.success) {
    return {
      kind: 'failure',
      message: json?.error?.message ?? 'Failed to create product',
    };
  }
  return { kind: 'success' };
}
