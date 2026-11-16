# Themed scrollbars

UI update #14 — the app used the operating system's default grey scrollbar.
Scroll containers (the store `<main>`, tables, sheets, the POS cart, etc.) now
render a thin scrollbar derived from the brand palette.

## Tokens

`globals.css` defines four scrollbar tokens alongside the chart/sidebar tokens:

```css
--scrollbar-size: 10px;
--scrollbar-track: transparent;
--scrollbar-thumb: color-mix(in srgb, var(--color-terracotta) 82%, var(--color-pearl));
--scrollbar-thumb-hover: var(--color-espresso);
```

`color-mix` keeps the thumb tied to `--color-terracotta`, so changing the brand
colour changes the scrollbar too. The track stays transparent: on the linen page
surface it is invisible, on white cards it matches the card, and on the dark POS
toolbar it inherits the dark surface.

## Implementation

The rules live in `@layer base` so Tailwind utilities still win:

- **Standard properties** (Firefox, Chromium 121+): `scrollbar-width: thin` and
  `scrollbar-color: var(--scrollbar-thumb) var(--scrollbar-track)` on every
  element.
- **WebKit/Blink**: `::-webkit-scrollbar` is 10 px tall/wide with a floating
  6 px thumb (`border: 2px solid transparent` + `background-clip: content-box`),
  a `999px` radius, an espresso hover/active state, a transparent corner, and no
  arrow buttons.
- **`.scrollbar-none`** (sidebar navigation) keeps working: it is generated in
  the utilities layer, which outranks the base rules — `scrollbar-width: none`
  and `::-webkit-scrollbar { display: none }`.

Because the rules are unlayered-selector free (`*` and pseudo-elements inside
`@layer base`), nested scroll areas inherit the theme without adding per-page
classes.

## Verification

`tests/49_theme_scrollbars.spec.ts` logs in and checks `/appointments`:

- `getComputedStyle(main).scrollbarWidth === "thin"` and `scrollbarColor`
  resolves to the terracotta mix;
- `::-webkit-scrollbar` is 10 px wide and the thumb has a `999px` radius and a
  non-transparent background;
- `--scrollbar-thumb` still contains `color-mix(... #a48374 ...)`;
- the `nav.scrollbar-none` element computes to `scrollbar-width: none` and
  `::-webkit-scrollbar { display: none }`.

## Files

- `src/app/globals.css`
- `tests/49_theme_scrollbars.spec.ts`
