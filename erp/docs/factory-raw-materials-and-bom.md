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

## Migration

- `prisma/migrations/20261101000000_add_raw_material_categories_and_units`
  adds the category table, seeds defaults for existing tenants, and widens
  `raw_materials.category` to text.
- `prisma/migrations/20261109010000_add_raw_material_units` adds the unit
  catalog, seeds `LITERS` / `KILOGRAMS` / `UNITS` for existing tenants, widens
  `raw_materials.unit` to text, and drops the old `Unit` enum.
