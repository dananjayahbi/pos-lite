# Client bundle boundary (Prisma runtime and `server-only`)

## Symptom

`next build` fails while generating a client chunk. Two messages share the same
root cause — a server module reached from a `'use client'` entry point:

```
Code generation for chunk item errored
./node_modules/@prisma/client/runtime/client.mjs
  the chunking context (unknown) does not support external modules
  (request: node:module)

Import trace:
  Client Component Browser:
    ./node_modules/@prisma/client/runtime/client.mjs [Client Component Browser]
    ./src/generated/prisma/internal/prismaNamespace.ts [Client Component Browser]
    ./src/generated/prisma/client.ts [Client Component Browser]
    ./src/lib/validators/product.validators.ts [Client Component Browser]
    ./src/components/stock-control/StockAdjustmentForm.tsx [Client Component Browser]
```

```
./src/lib/constants/courier.ts:1:1
Ecmascript file had an error
> 1 | import "server-only";
  You're importing a component that needs "server-only".
  The error was caused by importing 'src/lib/constants/courier.ts'

Import trace:
  Client Component Browser:
    ./src/lib/constants/courier.ts [Client Component Browser]
    ./src/lib/services/dispatchStatus.core.ts [Client Component Browser]
    ./src/app/(store)/orders/OrdersPageClient.tsx [Client Component Browser]
```

Turbopack reports only the FIRST offending path and then stops, so a single fix
can uncover the next one. `next dev` usually renders fine, so the failure only
shows up at build time.

## Cause

- `src/generated/prisma/client.ts` imports the Prisma runtime, which executes
  `node:module` and `node:path` at import time. It cannot be part of a browser
  bundle.
- `src/lib/constants/courier.ts` is marked `import "server-only"` because it
  reads `TRANSEXPRESS_*` from the environment.
- Both modules were imported by code that is shared with client components:
  validators (`product.validators.ts`) and "core" helpers
  (`dispatchStatus.core.ts`).

Type-only imports are erased by TypeScript and are always safe:

```ts
import type { UserRole } from '@/generated/prisma/client';
```

## Fix

Shared modules that need enum **values** in the browser import the
dependency-free generated module instead:

```ts
// src/lib/validators/product.validators.ts
import { HealthConcern, TaxRule, StockMovementReason, ProductSource } from '@/generated/prisma/enums';
```

Shared modules that need data from a `server-only` module get their own
browser-safe home, and the server module re-exports it so existing server
callers keep working:

```ts
// src/lib/constants/delivery-status.ts  (new, no "server-only")
export const DELIVERY_STATUS_RANK: Record<DeliveryStatus, number> = { /* ... */ };
export function isDeliveryStatusAdvance(...): boolean { /* ... */ }

// src/lib/constants/courier.ts  (still "server-only")
export {
  DELIVERY_STATUS_RANK,
  TERMINAL_DELIVERY_STATUSES,
  isDeliveryStatusAdvance,
} from './delivery-status';
```

`server-only` deliberately stays on `courier.ts`: it is the module that reads
the environment, so allowing it into the browser would leak server config.

## Guard

`src/lib/__tests__/client-bundle-server-boundary.test.ts` walks the import
graph from every `'use client'` entry point (resolving `@/` aliases and relative
specifiers, skipping type-only imports) and fails if any reachable module:

- imports `@/generated/prisma/client` or `@prisma/client` at runtime,
- imports `server-only`, or
- imports a module that is itself marked `server-only`.

It prints the entry, the offending file/line and the full import chain, which is
what the Turbopack error would have shown one path at a time. `'use server'`
modules are skipped because Next replaces them with RPC client references.

## Rules of thumb

| Need in a browser bundle | Import |
| --- | --- |
| Enum values | `@/generated/prisma/enums` |
| Enum / model types | `import type { X } from '@/generated/prisma/client'` |
| Pure constants shared with client code | a browser-safe module without `server-only` |
| `process.env`, Node APIs, Prisma client | server module only (`server-only`) |
