# POS success toasts are click-through (ARGUS #69)

The app-wide Sonner toaster sits at `top-right`. In the POS that position
overlaps the cart rail header, so an "Added … to cart" success toast could
intercept the pointer and swallow a click on **Clear Cart**.

## Rule

Success toasts are informational only — no action button is ever attached to
`toast.success(...)`. They therefore render with the `cn-toast-passive` class
(`src/components/ui/sonner.tsx`), and `src/app/globals.css` gives that class
`pointer-events: none`.

- Clicks and scans pass straight through the toast to the control underneath.
- Warning/error toasts and plain `toast()` action toasts (e.g. **Cart cleared →
  Undo**) stay interactive; they are not affected by the rule.
- Accessibility is unchanged: Sonner still announces the toast through its
  polite live region, and it still auto-dismisses.

## Verification

UI-only change. `npx tsc --noEmit` plus the existing POS component tests
(`src/components/pos/__tests__`) cover the surrounding behaviour.
