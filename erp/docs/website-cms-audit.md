# Website CMS writes are audited with the real actor

Only the config PUT wrote an audit row. It was an after-only `UPSERT` with
`actorRole` hard-coded to `OWNER`; slide/ad create/update/delete, the config's
full slide/ad replacement and the reset wrote nothing (ARGUS #498).

## Actions

Every destructive website CMS write now uses the durable `writeAuditLog`
(failures surface instead of being swallowed) and records the session's real
actor id and role:

| Operation | Action | Entity |
| --- | --- | --- |
| Config PUT / initial config creation | `WEBSITE_CONFIG_UPDATED` | `WebsiteConfig` |
| Hero slide create | `WEBSITE_HERO_SLIDE_CREATED` | `WebsiteHeroSlide` |
| Hero slide update | `WEBSITE_HERO_SLIDE_UPDATED` | `WebsiteHeroSlide` |
| Hero slide delete | `WEBSITE_HERO_SLIDE_DELETED` | `WebsiteHeroSlide` |
| Config save replacing all slides | `WEBSITE_HERO_SLIDES_REPLACED` | `WebsiteHeroSlide` |
| Ad create | `WEBSITE_AD_CREATED` | `WebsiteAd` |
| Ad update | `WEBSITE_AD_UPDATED` | `WebsiteAd` |
| Ad delete | `WEBSITE_AD_DELETED` | `WebsiteAd` |
| Config save replacing all ads | `WEBSITE_ADS_REPLACED` | `WebsiteAd` |
| Full reset | `WEBSITE_CONFIG_RESET` | `WebsiteConfig` |

## Snapshots

`websiteAuditRecord` + `serializeWebsiteAudit`
(`src/lib/website/websiteAudit.core.ts`) build a JSON-safe before/after:

- config update: previous config row (or null) and the new row;
- child create: `before: null`, full created row as `after`;
- child update/delete: full row before, full row after (or null);
- replacement: `{ count, slides|ads }` before and after;
- reset: full previous config including slides/ads, then the reset defaults,
  empty collections and the storage-cleanup summary.

Dates become ISO strings and `undefined` becomes null. Routes pass
`session.user.id`/`session.user.role`, removing the hard-coded OWNER role.

## Verification

- `src/lib/website/__tests__/websiteAudit.core.test.ts` covers the record shape,
  real actor, date serialisation and null/array handling.
- `src/lib/services/__tests__/websiteAudit.service.test.ts` mocks Prisma and the
  audit writer to pin the action, actor and before/after for config update,
  slide create, ad delete, full replacement and reset.

## Risk

Auditing is durable but not in the same transaction as the mutation for the
single-row child operations: if the audit write fails after the row committed,
the request returns 500 while the content change is already saved. The reset and
config replacement audit after their DB transaction for the same reason. A
future hardening step could write the audit inside the same transaction.
