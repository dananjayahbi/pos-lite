/**
 * Post-save refresh plan for the Store Profile form (ARGUS #488).
 *
 * The ERP shell (sidebar/dashboard/header) receives the business name and logo
 * from the server layout, so updating the form state and showing a toast left
 * the chrome showing the old branding until a full reload. The save path needs
 * to refresh the server tree and any client cache that embeds branding.
 *
 * Kept pure so the exact keys and the shell refresh are testable and the form
 * cannot silently stop refreshing one of them.
 */

/**
 * React Query caches that embed tenant branding. The label/waybill template
 * endpoint returns name/address/phone in `meta.branding`.
 */
export const STORE_PROFILE_BRANDING_QUERY_KEYS: ReadonlyArray<readonly string[]> = [
  ['label-template'],
];

export interface StoreProfileRefreshPlan {
  brandingQueryKeys: ReadonlyArray<readonly string[]>;
  /** `router.refresh()` must run so the server layout re-reads Tenant branding. */
  refreshShell: boolean;
}

export function storeProfileRefreshPlan(): StoreProfileRefreshPlan {
  return {
    brandingQueryKeys: STORE_PROFILE_BRANDING_QUERY_KEYS,
    refreshShell: true,
  };
}
