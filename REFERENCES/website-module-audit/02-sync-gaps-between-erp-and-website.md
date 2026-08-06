# 02 — Sync Gaps Between ERP and the Customer-Facing Website

This document covers the revalidation/caching gaps that cause the storefront to show stale data after ERP changes. The tag scheme itself is well aligned; the gaps are in **coverage** and **failure reporting**.

---

## Finding 2.1 — Category (and brand) counts go stale after product changes

**Severity:** Medium
**Area:** ERP → website revalidation coverage

### Symptom
After creating, updating, archiving, or deleting a product (or changing variants / bulk prices / imports), the storefront's **category listing still shows the old product count** for up to the refresh interval, even though the product itself updates immediately.

### Root cause
Product-related mutation flows trigger a storefront revalidation that purges product tags and paths but **does not purge the category/brand tags**. The category list is cached under a category tag, so when the number of products in a category changes, that cached list is not invalidated. Product listings are fine (they use the product tag, which is purged); only the category-level aggregate (product counts, category grids) is stale.

### Impact
Counts shown on the category page and category grid can be wrong for up to the revalidation interval (60 seconds by default, or the ISR window).

### Recommended fix direction
Make every product mutation also purge the category (and brand) tags — i.e. the catalog scope — not just the product scope. This is a small, centralized change in the revalidation helper wiring.

---

## Finding 2.2 — Stock is not revalidated after a storefront order is placed

**Severity:** High
**Area:** Storefront order flow → ERP stock → storefront

### Symptom
When a customer places an order, the products' stock levels on the storefront do not refresh promptly; the site can keep showing quantities that are no longer available, potentially overselling.

### Root cause
The public order-acceptance endpoint in the ERP performs **no storefront revalidation** after it commits an order, so the product/stock data cached on the website is not purged. In addition, the storefront cart snapshots available stock when an item is added, and the checkout flow does not re-check live stock before placing an order.

### Impact
- Product stock shown to customers lags actual inventory after purchases.
- The cart/checkout can proceed with quantities that exceed live stock (no live re-check), enabling overselling.

### Supporting context
- The revalidation helper is currently wired into config and catalog mutation flows but not into the order flow.
- The delivery integration may own part of this flow, so a fix must be coordinated.

### Recommended fix direction
After an order is committed, trigger a storefront revalidation that purges the affected product tags/paths (and the tenant/product tags) so stock and availability refresh. Separately, add a live stock validation step in checkout before order placement, and/or have the cart re-check stock against the server.

---

## Finding 2.3 — Revalidation endpoint reports success even when some items fail

**Severity:** Medium
**Area:** Website on-demand revalidation endpoint

### Symptom
If the ERP asks the website to purge several tags/paths and one of them fails (e.g. an invalid path or an internal error), the website still responds that everything succeeded. The ERP then assumes all caches are purged when some were not.

### Root cause
The revalidation endpoint processes each requested tag/path individually, and when one throws it records an error but **continues and returns an overall success response**, excluding the failed items from the success payload without surfacing a failure to the caller.

### Impact
Silent partial staleness: a tenant's storefront can keep serving cached content for some pages even though the ERP believes a full purge happened.

### Recommended fix direction
Return a non-success status (or an explicit partial-failure marker with the list of failed tags/paths) whenever any requested item fails, so the ERP can log and/or retry.

---

## Finding 2.4 — Revalidation is best-effort and failures are invisible end to end

**Severity:** Medium (robustness)
**Area:** ERP → website revalidation transport

### Symptom
When the website is down, misconfigured, or the shared secret is missing, a save in the ERP still reports success and no one is alerted that the storefront will be stale.

### Root cause
On the ERP side, every revalidation call is wrapped so that failures only produce a warning log and never affect the save result. On the transport side, network errors are swallowed and the secret, if unset, causes an early silent skip. Combined with Finding 2.3, a failed purge is effectively invisible.

### Impact
Config/catalog changes can silently fail to reach the storefront, leaving customers on stale content indefinitely (until the next interval refresh for tag-driven data).

### Recommended fix direction
Surface revalidation failures (at minimum as visible admin-facing warnings/audit logs, ideally with an optional retry). Consider a queue/retry for best-effort purge so a transient website downtime does not cause permanent staleness.

---

## Finding 2.5 — Inconsistent incremental-static-regeneration (ISR) configuration on the storefront

**Severity:** Medium
**Area:** Customer-facing website pages

### Symptom
Different storefront pages behave differently with respect to caching and freshness with no deliberate rationale.

### Root cause
- Home, Shop, About, and Contact are set to always render dynamically per request (but each data fetch still uses the 60-second tag-based cache).
- Product and Category detail pages use time-based ISR (revalidate every 60 seconds).
- The Cart page disables caching.
- The **Checkout page has no explicit caching configuration**, so it silently inherits the default time-based caching — which is almost certainly unintended for a transactional page.

### Impact
- The checkout page can serve a slightly cached response (up to the default interval), which is risky for a transactional flow.
- The mix of strategies makes behavior harder to reason about and test.

### Recommended fix direction
Standardize the strategy by page type: dynamic/no-cache for checkout (and likely cart), and a consistent, tag-driven policy for catalog pages. Give every route an explicit config so behavior is intentional.

---

## Finding 2.6 — Default-tenant revalidation paths omit the clean URLs

**Severity:** Low (latent)
**Area:** ERP revalidation helper

### Symptom
For the default tenant, the ERP purges the prefixed storefront path and shop path but **not the root path or the clean shop/about/contact paths** that the default tenant actually uses.

### Root cause
The revalidation helper always targets a tenant-slug-prefixed set of paths and never the clean root/clean route set. Today this does not cause visible staleness because the affected pages are dynamically rendered and their data is purged via tags, but it would break the moment any of those pages becomes time-based ISR.

### Supporting context
- The website config save flow compensates for this by also purging the root path and clean routes for the default tenant.
- The default tenant's product/category links are prefixed while its nav links are clean, producing a mixed URL scheme.

### Recommended fix direction
Have the revalidation helper include the clean root/clean routes when the tenant is the default tenant, or better, derive the purge path set from the tenant's home-path rule so the two always agree.

---

## Finding 2.7 — No single-category fetch endpoint; category page downloads the full list

**Severity:** Low (performance)
**Area:** Customer-facing website category data

### Symptom
Each category detail page requests up to 200 categories and filters them client-side to find the one being viewed.

### Root cause
There is no single-category public endpoint, so the website uses the list endpoint with a large limit as a workaround. This works only because the tenant's category count is capped at 200.

### Impact
Wasted bandwidth/processing per category page; will break or be very inefficient if a tenant ever exceeds the cap.

### Recommended fix direction
Add a public single-category endpoint (by id within a tenant slug) and have the category page use it.
