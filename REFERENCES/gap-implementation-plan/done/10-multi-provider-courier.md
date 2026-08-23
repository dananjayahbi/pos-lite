# 10 — Multi-Provider Courier Abstraction

**Module:** M3.1 — Courier Integration
**Severity:** High
**Status:** Partially implemented
**Related docs:** [09](./09-customer-delivery-status.md)

## Issue / Current State

Only Trans Express is integrated as a courier. The courier code lives under `erp/src/lib/courier/trans-express/` (with modules for `auth`, `client`, `adapter`, `orders`, `tracking`, `locations`, `mappers`, `errors`, and `types`), and the `CarrierProvider` enum in `erp/prisma/schema.prisma` defines only `TRANSEXPRESS`.

There is already a small abstraction in place: `erp/src/lib/courier/index.ts` exports a `transExpressAdapter`, and a `types.ts` defines courier-related contracts. However, the abstraction is not provider-agnostic — there is no formal provider contract/interface, no provider registry, and no configuration seam for additional carriers, even though the SRS calls for Domex, PromptX, and Koombiyo support.

## Impact

- The business is single-sourced to one courier, creating pricing and reliability risk and limiting coverage options for customers.
- Without a proper provider contract, adding each new carrier requires bespoke plumbing instead of registering a provider, increasing cost and error risk.
- Reconciliation and tracking are coupled to one provider, so a second provider cannot be introduced cleanly.

## Implementation Plan

### Step 1 — Define a provider contract
Formalize a provider-agnostic adapter interface in `erp/src/lib/courier/types.ts` describing the operations every provider must implement — authenticate, create shipment, upload/label, track by reference, and quote rates. Express it in terms of the existing courier domain types so the Trans Express adapter maps onto it without behavioral change.

### Step 2 — Add a provider registry
Introduce a provider registry in `erp/src/lib/courier/index.ts` (or a new `registry.ts`) that maps a provider identifier to its adapter implementation. Register the existing Trans Express adapter under `TRANSEXPRESS`. Make `erp/src/lib/courier/index.ts` the single entry point that code resolves a provider through, replacing direct imports of the trans-express modules where feasible.

### Step 3 — Add provider configuration
Add a configuration seam (database-backed settings or env-driven config) for per-carrier credentials and environment (the `CourierEnv` staging/production distinction already exists) so providers are not hardcoded. Document the shape each provider needs (auth credentials, base URLs, callback/notification hooks).

### Step 4 — Add additional carriers
Register Domex, PromptX, and Koombiyo as new adapters implementing the same contract, with provider-specific `auth`, `client`, and `mappers` modules mirroring the existing `trans-express/` layout. Extend the `CarrierProvider` enum in `erp/prisma/schema.prisma` to include the new providers and migrate.

### Step 5 — Decouple downstream consumers
Update the courier-facing services (shipment, tracking, reconciliation) so they select a provider by configuration rather than assuming Trans Express. Ensure the delivery-status mapping from 09 stays provider-agnostic so status timelines work uniformly across providers.

## Dependencies
- [09](./09-customer-delivery-status.md) relies on provider-agnostic status mapping.
- Reconciliation docs (Module 4) depend on provider-agnostic financial data.

## Files / Areas affected
- `erp/src/lib/courier/types.ts` (formal contract)
- `erp/src/lib/courier/index.ts` (registry / entry point)
- New provider folders under `erp/src/lib/courier/domex/`, `.../promptx/`, `.../koombiyo/` (mirroring `trans-express/`)
- `erp/prisma/schema.prisma` (`CarrierProvider` enum) + migration
- `erp/src/lib/services/shipment.service.ts`, `tracking.service.ts`, `reconciliation.service.ts`
