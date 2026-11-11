# Webhooks settings page removed

The `/settings/webhooks` management page has been removed from this system.

## What was removed

- `src/app/(store)/settings/webhooks/page.tsx`
- `src/components/settings/WebhooksPageClient.tsx`
- Sidebar entry, settings-catalog card, and global search entry.

## What remains

The outbound webhook **runtime** is intentionally still present because sale,
return and inventory flows dispatch events to subscribed endpoints
(`src/lib/webhooks/*`, `dispatchWebhooks`). The supporting API routes remain for
programmatic/integration use:

- `GET/POST /api/webhooks/endpoints`
- `GET /api/webhooks/endpoints/:id/deliveries`
- `POST /api/webhooks/endpoints/:id/test`
- `DELETE /api/webhooks/endpoints/:id`
- `POST /api/webhooks/deliveries/:id/retry`
- `GET /api/cron/webhook-retries`

These routes keep their `settings:webhooks:view` / `settings:webhooks:manage`
permission guards and tenant isolation, but there is no longer a UI surface for
managing them.

Regression coverage in `tests/33_webhooks.spec.ts` now asserts the page returns
404 while the API contracts remain intact.
