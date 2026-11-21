# Voided sale receipt and tender (ARGUS #86)

The **Print Receipt** button is disabled for a voided sale, but the receipt URL
is still reachable (a manager can copy it, or open it from history). That URL
returned a normal-looking receipt with no void marking, and the detail page
listed the original CARD payment with no reversal indicator even though the
account ledger had been reversed.

## Receipt

`buildThermalReceiptHtml` reads `sale.status`. For `VOIDED` it renders:

- a bordered **VOID** stamp under the store header;
- the line "This sale was voided. Stock and tenders were reversed; this is not
  a valid receipt.";
- every payment row suffixed `(reversed)`.

The document title becomes `Receipt (VOID) – <ref>`. A completed sale is
unchanged; the receipt is stamped rather than blocked so an archived copy still
explains itself.

## Detail page

The Payments section shows a red note and each tender is labelled `reversed`
when the sale status is `VOIDED`. The sale's status badge and the existing void
banner are unchanged.

## Verification

`src/lib/__tests__/receipt-renderer.test.ts` covers the stamp, the reversed
tender and the unchanged completed receipt.
