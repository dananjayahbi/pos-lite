# Stock-take session identifiers

ARGUS #191.

The stock-take list used to render `id.slice(0, 8)` and the review header a
12-character fragment with an ellipsis, and neither offered a copy action. An
operator reporting a problem therefore had no unambiguous reference.

- The table now shows a compact reference made of the **first 8 and last 4**
  characters, with the complete cuid in the tooltip (`title`).
- A copy button on both the list and the review header writes the full id to the
  clipboard and confirms with a toast.
- `stockTakeIdValue` / `stockTakeIdReference` in
  `src/lib/stock/stock-take-id.ts` own the formatting so the two screens cannot
  drift.

The full id remains the canonical audit/support reference: the visible
shortening is presentation only.
