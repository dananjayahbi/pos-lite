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

`Unit` now includes `UNITS` alongside `LITERS` and `KILOGRAMS`, so packaging
items such as empty bottles and bottle caps can be counted in units. Short
labels are `L`, `kg`, and `unit`.

## BOM ingredient table

The **New/Edit Bill of Materials** modal renders ingredients as a table with
dedicated columns:

| Raw material | Available | Unit | Qty / unit |
| --- | --- | --- | --- |

Selecting a raw material fills the available stock and unit automatically; the
quantity input shows the selected unit as a suffix.

## Migration

`prisma/migrations/20261101000000_add_raw_material_categories_and_units`
adds the category table, seeds defaults for existing tenants, widens
`raw_materials.category` to text, and appends the `UNITS` enum value.
