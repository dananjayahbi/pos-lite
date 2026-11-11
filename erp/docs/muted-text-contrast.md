# Muted text/icon contrast

## Problem

The brand palette originally used the same two light beige tokens for both
surfaces and muted copy:

| Token | Old value | Contrast on pearl (`#F1EDE6`) |
| --- | --- | --- |
| `--color-sand` | `#CBAD8D` | 1.82:1 |
| `--color-mist` | `#D1C7BD` | 1.43:1 |

That is below the 3:1 minimum for large text/icons, so sidebar group headers,
"7 brands"-style subtitles, metadata labels (`ID`, `NAME`, `PRODUCTS`,
`CREATED`, …) and muted icons were hard to read.

## Fix: separate text ink from surfaces

`globals.css` now defines two additional **text-only** tokens:

| Token | Value | Contrast on pearl | Contrast on linen |
| --- | --- | --- | --- |
| `--color-sand-ink` | `#86684D` | 4.39:1 | 4.03:1 |
| `--color-mist-ink` | `#7B6E64` | 4.23:1 | 3.89:1 |

`--color-sand` / `--color-mist` keep their old values, so borders, skeleton
backgrounds and hover surfaces do not become unexpectedly heavy.

Every `text-sand` / `text-mist` utility in `erp/src` (including hover/focus
variants and opacity suffixes such as `text-sand/80`) was migrated to the new
ink token. Non-text utilities (`border-sand`, `bg-mist`, `fill-mist`, …) are
untouched.

## Scope

The migration was applied across every `.ts`/`.tsx` file under `erp/src`
(excluding generated Prisma code): 235 files. The page called out in the issue
(`/brands`) now renders:

- the "7 brands" subtitle at `rgb(123, 110, 100)` instead of the old near-white
  beige,
- sidebar category headers (`OVERVIEW`, `RETAIL & CLINIC`, `INVENTORY`, …) and
- the ID/NAME/PRODUCTS/CREATED/UPDATED/DESCRIPTION metadata labels/icons

at the same darker ink.

## Guidance for new UI

- Use `text-sand-ink` / `text-mist-ink` for muted copy and icons.
- Keep `border-sand` / `border-mist` / `bg-sand` / `bg-mist` for structure and
  surfaces.
- Prefer `text-espresso` for primary copy and `text-text-muted` where a neutral
  grey-brown is wanted.

## Verification

- `npx tsc --noEmit` clean.
- Full Vitest suite passes.
- Browser check on `/brands`: computed label/subtitle colour is
  `rgb(123, 110, 100)` and the page no longer has `text-sand` / `text-mist`
  utilities (grep returns zero).
