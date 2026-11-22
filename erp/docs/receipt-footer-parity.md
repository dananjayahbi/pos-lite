# One receipt footer and contact policy (ARGUS #491)

The three sale-document paths disagreed when the profile footer was cleared:

| Path | Old fallback | Old contact block |
| --- | --- | --- |
| Browser 80 mm sale receipt | "Thank you for your purchase!" | address + phone |
| ESC/POS printer | "Thank you for your purchase!" | none |
| A4 return receipt | "Thank you for shopping with us!" | address + phone |

All three now call `resolveReceiptFooter()` and `receiptContactLines()` from
`src/lib/settings/receiptIdentity.core.ts`:

- one fallback, `DEFAULT_RECEIPT_FOOTER` ("Thank you for shopping with us!");
- a whitespace-only footer is treated as blank;
- address (multi-line), then `Tel: <phone>` on every path, including ESC/POS;
- blank contact fields print nothing rather than empty labelled lines.

The ESC/POS receipt prints the contact lines centred under the store name, the
same position as the browser receipt header. Arabic/Tamil/emoji footer text is
unchanged (it was already stored and printed verbatim, escaped in HTML).

`receipt-renderer.test.ts` and `return-receipt-renderer.test.ts` pin the shared
fallback; `receiptIdentity.core.test.ts` pins the contact policy. The printer
buffer itself needs a live printer, so its header block is verified by the
shared helper and code review.
