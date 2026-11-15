# Product image thumbnails (full + icon version)

Feature update #14 — when a product image is uploaded it is stored twice:

| Version | Size | Used by |
| --- | --- | --- |
| Full image | original (provider-optimised WebP for Cloudinary) | website product pages/cards, product detail galleries |
| Thumbnail | **256 × 256 WebP**, quality 72, centre-cropped | POS product grid, inventory rows, variant tables, sale picker, upload previews |

## Upload pipeline

`POST /api/upload` now returns both URLs:

```json
{ "url": "https://cdn/....webp", "thumbnailUrl": "https://cdn/...-thumb.webp" }
```

- `src/lib/image-thumbnail.ts` uses `sharp` to rotate by EXIF, resize with
  `fit: cover` to 256×256, and encode WebP at quality 72.
- The full upload happens first; the thumbnail is generated and uploaded second.
  If thumbnail generation fails, the endpoint still returns the full `url` with
  `thumbnailUrl: null` and consumers fall back to the full image.

## Storage (schema)

```prisma
model Product {
  mainImageUrl          String?
  mainImageThumbnailUrl String?
}

model ProductVariant {
  imageUrls          String[] @default([])
  thumbnailImageUrls String[] @default([]) // parallel to imageUrls
}
```

Migration: `prisma/migrations/20261115090000_add_image_thumbnails/migration.sql`.

The arrays are index-aligned: `thumbnailImageUrls[i]` belongs to
`imageUrls[i]`. The wizard re-orders both arrays together when the operator
chooses a primary image, and removal keeps the indices in sync.

## Consumers

Thumbnails are preferred wherever the rendered size is icon-like:

- POS: `ProductCard`, `VariantSelectionModal`
- Inventory: `InventoryTable` rows
- Product detail: `VariantsTab` row tiles (the image viewer still opens the
  full URLs), `ProductImageUpload` preview
- Sales: `NewSaleSheet` search results via `resolveProductThumbnail()`
- `MainImageUpload` preview

`resolveDisplayImage(full, thumbnail)` / `resolveProductThumbnail(...)` fall back
to the full URL for rows created before thumbnails existed, so nothing breaks
during the transition.

## Backfill

```bash
cd erp
node --env-file=.env --import tsx scripts/backfill-image-thumbnails.ts --dry-run
node --env-file=.env --import tsx scripts/backfill-image-thumbnails.ts
```

The script downloads each existing image, generates the 256×256 WebP, uploads
it and updates the product/variant row. It only touches rows with missing
thumbnails and reports images it could not download.

## Tests

- `src/lib/image-thumbnail.test.ts` — square WebP output, size reduction,
  custom edge size, full-image fallback.
- Run the upload flow in the browser (Add Product → Main Image / variant
  images) and confirm the response contains `thumbnailUrl`, the POS tile loads
  the `-thumb` URL, and the website still uses the full image.
