# Prisma client cache in development

## Symptom

After adding a model or changing the Prisma schema and running `prisma generate`,
a long-running `next dev` process fails requests with a generic server error:

```
Could not load payroll preview: An unexpected error occurred
```

The browser Network tab shows `500 {"code":"INTERNAL_SERVER_ERROR"}`, and the
server console logs an unhandled Prisma error such as
`Cannot read properties of undefined (reading 'findUnique')` for the new model.

## Cause

- `prisma generate` writes the client to `src/generated/prisma`, which Next.js
  watches and recompiles.
- `src/lib/prisma.ts` caches the `PrismaClient` on `globalThis` so hot reloads
  do not open a new connection pool for every edit.
- The cached client was built from the previous generated output, so it does not
  know about models added by the latest `prisma generate`.

This is a development-only problem. A production build always loads the client
generated for that build.

## Fix

`src/lib/prisma.ts` now records a signature of the generated data model
(`Prisma.ModelName`) next to the cached client. When the signature changes, the
old client is discarded and a new one is created on the next request, so the
first request after `prisma generate` works without restarting the dev server.

The decision is a pure helper (`src/lib/prisma-signature.ts`) covered by
`src/lib/__tests__/prisma-signature.test.ts`.

## Still restart when

- The signature only tracks model names. If only **fields** changed and existing
  code now uses the new field, restart `next dev` once after `prisma generate`.
- You changed `DATABASE_URL` or authentication configuration in `.env` /
  `.env.local`; environment variables are read when the module first loads.
