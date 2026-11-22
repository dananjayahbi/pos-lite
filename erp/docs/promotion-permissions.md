# Promotions page permissions and load states

ARGUS #332. The Promotions page rendered for every authenticated role even
when the promotions API answered 403. A role without create/edit could see
"New Promotion", Edit, the status switches and Customer Pricing's "Add rule";
a failed load looked like "no promotions"; and status changes had no error
feedback.

## Permission gate

`src/app/(store)/promotions/page.tsx` is now a server component:

- resolves the effective permissions (`getEffectivePermissions`);
- derives capabilities with `resolvePromotionPageAccess`
  (`src/lib/services/promotionAccess.core.ts`);
- renders **Access Restricted** when the user holds neither
  `promotion:create` nor `promotion:edit` (the list API's OR-gate);
- passes `canCreate` / `canEdit` / `canDelete` /
  `canManageCustomerPricing` to `PromotionsPageClient`.

Client controls mirror the API keys:

| Control | Permission |
| --- | --- |
| New Promotion | `promotion:create` |
| Edit / status switch / Activate | `promotion:edit` |
| Deactivate | `promotion:delete` |
| Customer Pricing tab | `promotion:edit` |
| Add rule | `promotion:create` |
| Edit / Deactivate rule | `promotion:edit` |

A view-only user sees the list and badges without controls. The server gate is
defence in depth; every API route still enforces its own permission.

## Load and mutation states

- The promotions query exposes `isError`; a failure renders an explicit error
  card with **Retry**, never the empty state.
- The customer-pricing query does the same.
- Create, update, activate, deactivate and status-toggle mutations show an
  error toast with the API message.
- The list `Usage` column shows the ARGUS #331 derived sale count.

## Verification

- `src/lib/services/__tests__/promotionAccess.core.test.ts`
- `npx tsc --noEmit`
