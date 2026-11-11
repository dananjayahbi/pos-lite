# Customer contact, address and city

The New/Edit Customer sheet now captures a fuller customer card while keeping
the existing phone-per-tenant uniqueness contract.

## Fields

| Field | API key | Required | Notes |
| --- | --- | --- | --- |
| Name | `name` | yes | Unchanged (1–100 chars). |
| Phone | `phone` | yes | Sri Lankan format, normalised to `+94XXXXXXXXX`. |
| Contact No 2 | `phone2` | no | Optional secondary number. Empty input is accepted; non-empty values use the same Sri Lankan phone validation as `phone`. |
| Email | `email` | no | Unchanged. |
| Address | `address` | no | Free text, up to 250 characters, trimmed. |
| City | `city` | no | Selected from the Trans Express city list (see below), stored as the city name. |
| Gender / Birthday / Tags / Notes | unchanged | no | Existing fields. |

## City list (Trans Express alignment)

`GET /api/store/customers/cities` returns the options for the City selector.
It requires `customer:view` (so cashiers can create customers without courier
settings permissions) and reads the tenant's cached Trans Express master
locations from `tenant.settings.delivery.locations`, the same cache used by the
delivery module and populated by `POST /api/store/delivery/locations`.

```json
{
  "success": true,
  "data": {
    "cities": [{ "value": "Colombo", "label": "Colombo", "id": 42 }],
    "source": "TRANSEXPRESS",
    "syncedAt": "2026-11-06T06:00:00.000Z"
  }
}
```

- `source: "TRANSEXPRESS"` — options come from the synced courier cache.
- `source: "FALLBACK"` — the tenant has not synced locations yet; the curated
  `SRI_LANKA_CITIES` list is used so the form is never blocked. The UI tells the
  user to sync locations in Delivery settings for the complete list.
- Options are deduplicated case-insensitively and sorted alphabetically.
- A customer's existing city is always injected into the options so editing a
  legacy/unlisted city never clears it.

## Persistence

Migration `20261106000000_add_customer_contact_address_city` adds nullable
`phone2`, `address`, and `city` columns to `customers`.

On create, blank optional values are stored as `NULL`. On update, the sheet
always sends `phone2`, `address`, and `city` (empty string when cleared), and
the service maps an explicit empty string to `NULL` so clearing works.

## UI

`src/components/customers/CustomerSheet.tsx` is organised into Contact details,
Address, Personal details, Tags, and Notes sections, with a sticky Cancel/Create
footer. The customer detail page shows Contact No 2, Address, and City in both
the profile header and the About / Notes tab.

## Tests

- `src/lib/validators/__tests__/customer.validators.test.ts` — validation and
  normalisation of the new fields.
- `src/lib/utils/__tests__/customer-cities.test.ts` — cache/fallback option
  building, dedupe, sorting, and current-city preservation.
