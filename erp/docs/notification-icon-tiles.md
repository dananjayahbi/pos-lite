# Notification icon tiles

Feature update #20 — `/notifications` row icons had a "not rounded" background.
The element carried `rounded-full bg-linen p-2`, but it was also a flex child of
`flex gap-3`. Flex defaults to `align-items: stretch`, so the tile grew to the
height of the notification copy (32 × 62 px instead of 32 × 32 px). A fully
rounded 32 × 62 box is a capsule, which looked like a square badge rather than
the intended circle.

## Fix

The tile now owns its geometry instead of inheriting the row height:

```tsx
<div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center self-start rounded-full bg-linen text-terracotta">
  <Icon className="h-4 w-4" />
</div>
```

- `h-8 w-8` fixes the box at 32 × 32 px regardless of the copy length.
- `flex items-center justify-center` keeps the 16 px icon optically centered
  (the old `p-2` was exact, but no longer needed).
- `self-start` opts out of the flex row's stretch; `shrink-0` prevents
  shrinking when the row is narrow.

The shared icon table (`getNotificationIcon`) and the header popover are
unchanged — the popover renders the icon without a background tile, so it never
had the defect.

## Verification

`tests/51_notification_icon_tiles.spec.ts` logs in and opens `/notifications`,
waits for the client-fetched rows, then checks the first ten tiles:

- width is 30–34 px and height matches width within 1 px (square);
- computed `border-radius` is at least half the width (a true circle);
- the SVG's center is within 1 px of the tile center on both axes.

## Files

- `src/app/(store)/notifications/page.tsx`
- `tests/51_notification_icon_tiles.spec.ts`
