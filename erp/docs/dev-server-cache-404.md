# Dev server 404s after a production build

`next dev` on port 3003 served 404 for several dynamic routes (product detail,
per-product stock history, stock-control APIs, barcode lookup, category/brand
detail and delete, public storefront) while a clean compile of the same source
worked (ARGUS #180).

## Cause

Dev and production shared the `.next` dist directory. A `next build` leaves a
production route manifest and prebuilt chunks there; starting (or restarting)
`next dev` on the same directory reused that stale manifest, so routes that only
exist in the dev build were not registered and answered 404. Wiping the cache
until the next rebuild always fixed it.

## Fix

`next.config.ts` now picks a separate dist dir:

```ts
distDir: process.env.NODE_ENV === 'development' ? '.next-dev' : '.next',
```

- `next dev` builds into `.next-dev` (git-ignored).
- `next build` / `next start` keep using `.next`.

A production build no longer invalidates the dev server, and switching between
dev and prod never requires deleting the other cache.

For an already-broken environment (or after upgrading Next), run:

```bash
yarn dev:clean
```

`dev:clean` removes both `.next-dev` and `.next` and then starts the dev server;
`yarn dev` alone is enough once the directories exist.
