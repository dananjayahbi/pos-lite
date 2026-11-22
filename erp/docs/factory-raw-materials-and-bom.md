# Factory Raw Materials & BOM

## Raw material categories

Raw-material categories are tenant-managed rows (`raw_material_categories`)
instead of a closed enum. Every tenant is lazily seeded with the built-in
categories:

| Key | Default label |
| --- | --- |
| `OILS_LIQUIDS` | Oils & Liquids |
| `POWDERS_HERBS` | Powders & Herbs |
| `CHEMICALS` | Chemicals |

From the **Raw Materials** page operators can:

- add a category inline while creating/editing a material (the new category is
  selected immediately),
- rename a category, and
- delete a category — blocked with `CATEGORY_IN_USE` while active raw materials
  reference it, and with `LAST_CATEGORY` when it is the final remaining one.

Keys are derived from the display name (`Bottles & Caps` → `BOTTLES_CAPS`) and
stay stable across renames.

### API

| Method | Route | Permission |
| --- | --- | --- |
| `GET` | `/api/store/raw-material-categories` | `raw_material:view` |
| `POST` | `/api/store/raw-material-categories` | `raw_material:create` |
| `PATCH` | `/api/store/raw-material-categories/:id` | `raw_material:edit` |
| `DELETE` | `/api/store/raw-material-categories/:id` | `raw_material:delete` |

Raw materials return both the stable `category` key and a resolved
`categoryName` for display.

## Units

Units are tenant-managed rows (`raw_material_units`), not a closed enum. Every
tenant is lazily seeded with the built-in units:

| Key | Default label | Short label |
| --- | --- | --- |
| `LITERS` | Liters | `L` |
| `KILOGRAMS` | Kilograms | `kg` |
| `UNITS` | Units | `unit` |

Manage them from **Settings → Units** (`/settings/units`) or inline from the
**Add/Edit raw material** dialog with the **New** button next to the Unit
select. The new unit is selected immediately. Built-in units can be renamed but
not deactivated; deleting a unit is blocked with `UNIT_IN_USE` while a raw
material references it and `LAST_UNIT` when it is the final one.

Raw materials store the stable unit `key` and the API returns both the key and
the resolved `unitName` / `unitShortLabel` for display, so renaming a unit
updates the list, BOM and alerts without touching material rows.

### Units API

| Method | Route | Permission |
| --- | --- | --- |
| `GET` | `/api/store/units` | `raw_material:view` |
| `POST` | `/api/store/units` | `raw_material:create` |
| `PATCH` | `/api/store/units/:id` | `raw_material:edit` |
| `DELETE` | `/api/store/units/:id` | `raw_material:delete` |

`POST` accepts `{ name, shortLabel? }`. The key is slugified from the name
(`Bottles` → `BOTTLES`), and an omitted short label is derived from the key.

## BOM ingredient table

The **New/Edit Bill of Materials** modal renders ingredients as a table with
dedicated columns:

| Raw material | Available | Unit | Qty / unit |
| --- | --- | --- | --- |

Selecting a raw material fills the available stock and unit automatically; the
quantity input shows the selected unit as a suffix.

## Factory dashboard feed states

The dashboard's KPI strip, alerts panel, low-stock list and production history
each resolve an explicit state (ARGUS #244):

```
error -> loading -> empty -> data
```

`resolveFactoryFeedState()` (`src/components/raw-materials/factoryDashboardState.ts`)
makes an error outrank every data-dependent state. A failed alerts request can
therefore never render “All raw materials are above their low-stock
thresholds”, a failed list cannot render “No materials are currently low on
stock”, and a failed production feed cannot render “No production runs recorded
yet”. Each failed panel shows the feed message and a **Retry** button; KPI
values stay neutral (`-`) until the stats feed succeeds.

Cached/last-known rows are not presented as current: an error replaces the
panel rather than silently showing stale data. `factoryKpiValue()` guarantees a
failed or loading stats feed never renders `0`, which would read as “none”.

`src/components/raw-materials/__tests__/factoryDashboardState.test.ts` covers
the precedence, the neutral KPI value and the error-message fallback.

### One low-stock population (ARGUS #258)

The Low-stock/Out-of-stock KPI cards and the **Low stock materials** list now
derive from the same `raw-material-alerts` response as the alerts panel. The
old page mixed three sources: a stats count, the alerts feed, and a
`stockStatus=LOW&limit=5` list query (which also omitted out-of-stock rows and
could hide the sixth low row). `buildFactoryStockPopulation()` normalises
severity (zero stock is always `CRITICAL`), de-duplicates by material id, sorts
critical/out-of-stock first, and returns the counts and rows used by every
surface. The list header states both counts, so the KPI cards, alert summary
and list cannot disagree. `raw-materials` is no longer requested by the
dashboard itself.

### Zero-threshold out-of-stock alerts (ARGUS #260)

`evaluateRawMaterialAlert()` checks `quantity <= 0` before the threshold guard,
so a material at zero with a configured threshold of `0` raises `CRITICAL`
instead of silently disappearing from the alerts panel. A positive quantity
with no threshold still never alerts.

## Migration

- `prisma/migrations/20261101000000_add_raw_material_categories_and_units`
  adds the category table, seeds defaults for existing tenants, and widens
  `raw_materials.category` to text.
- `prisma/migrations/20261109010000_add_raw_material_units` adds the unit
  catalog, seeds `LITERS` / `KILOGRAMS` / `UNITS` for existing tenants, widens
  `raw_materials.unit` to text, and drops the old `Unit` enum.
