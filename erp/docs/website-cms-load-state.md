# Website CMS load states

The website settings form no longer treats a failed load or a tenant with no
config as "ready with defaults" (ARGUS #495). Previously `DEFAULT_CONFIG`
embedded the demo tenant's story, Colombo address, email and phone, and the form
merged them into every failure/empty case - a save then wrote that content for
another tenant and replaced its hero slides with an empty list.

## States

`resolveWebsiteLoadResult()` (`src/lib/website/load-state.ts`) classifies the
config GET:

| Response | UI |
| -------- | -- |
| 200 + config | form (merged over a neutral structural template) |
| 200 + `data: null` | explicit "Website not configured" panel with **Create website configuration**; no form/save until chosen |
| non-200 / invalid body | error panel with the message and **Retry**; no form/save |

## Non-destructive defaults

`DEFAULT_CONFIG` is now a neutral template: blank branding, address, phone,
email, story, mission, values and hero slides. It contains no tenant copy. New
sites fill it in deliberately; saving requires a non-empty **Site Name**.

Saving is additionally blocked unless the form is in the `ready` state or the
operator explicitly started from the empty state, so a load failure can never be
turned into a destructive save. The PUT route already leaves hero slides/ads
untouched when their arrays are absent; the client now only reaches it with a
successfully loaded (or deliberately blank) config.

## Verification

`src/lib/website/__tests__/load-state.test.ts` covers ready, empty, HTTP 500,
invalid body and the status-bearing fallback message.
