# Barcode sheet scan readability (Feature update #16)

`/inventory/barcode-printing` — why the printed labels were hard to scan and
what changed.

## Problems in the old sheet

1. **Human-readable digits were split over lines.** `react-barcode` renders the
   EAN-13 value as several SVG `<tspan>` fragments (`2 / 003424 / 422401`), so
   the number under the bars wrapped instead of reading as one value.
2. **Bars looked inconsistent.** EAN-13 draws longer guard bars at both ends
   and in the middle; on a small label that reads as "some lines are longer".
3. **No quiet zone.** The symbol was rendered with `margin={0}`, leaving no
   white space before the first bar or after the last — a common cause of
   hand-scanner misses.
4. **Bars were small.** 30 px height at width 1.05 gives a short symbol for
   handheld readers.

## Changes in `BarcodeSheet.tsx`

| Before | After |
| --- | --- |
| EAN-13 symbology (long guard bars) | **Code 128** — every bar the same height |
| `margin={0}` | 10 px quiet zone on both sides (`marginLeft/Right`) |
| `width={1.05} height={30}` | `width={1.25} height={46}` |
| built-in `displayValue` (multi-tspan, wrapped) | `displayValue={false}` + a single-line `<span>` with the exact value |
| 9 px proportional text | 10 px monospace, `white-space: nowrap`, 1 px letter-spacing |

The human-readable line shows the complete barcode value with no separators or
line breaks; `data-testid="barcode-human-value"` is used by the regression test.

## Is the format correct?

Yes:

- Stored product barcodes are **EAN-13** in the GS1 restricted-circulation range
  (`200` + 9 digits + a valid GS1 check digit), validated by
  `src/lib/barcode.ts` and its unit tests.
- The sheet **prints those values as Code 128**. Code 128 is a standard,
  losslessly scannable symbology that returns the same 13 digits at the POS;
  it is used here because it has uniform bar heights, which resolves the
  "longer lines" complaint and scans well at small label sizes.
- The POS lookup (`/api/store/variants/barcode/[barcode]`) receives the same
  digits, so existing scanners and workflows keep working.

## Test

`tests/41_barcode_readability.spec.ts` adds a variant from the demo catalog to
the sheet and asserts:

- the human value matches `^\d{13}$`, contains no whitespace/newlines, uses
  `white-space: nowrap`, and occupies a single 12 px line;
- every SVG bar has the same height (≥ 40 px), i.e. no EAN guard-bar spikes;
- the page copy names the Code 128 print format.

## Editing barcodes (ARGUS #154)

The variant edit sheet used to accept any 8-20 alphanumeric barcode, so a saved
EAN-13 could be replaced by a value no till scanner would match. Both the sheet
and `PATCH /api/store/variants/[id]` now enforce the in-store EAN-13 format:

- a changed value must be 13 digits with a valid GS1 check digit
  (`isValidEan13`), otherwise the request fails with
  `VALIDATION_ERROR` and the message
  `Barcode must be a 13-digit EAN-13 in-store code (for example 2003424422401)`;
- an **unchanged** legacy value (the five 12-character codes in the live data)
  is accepted, so editing price/stock or re-saving does not force a re-barcode;
- an explicit `null` clears the barcode through the API; the edit sheet itself
  always requires a 13-digit value once the field is changed;
- the wand button now calls the shared `generateBarcode()` (EAN-13 prefix 200)
  instead of the old `VLV…` string.

Logic: `barcodeEditError()` in `src/lib/barcode.ts`;
tests: `src/lib/barcode.test.ts`.
