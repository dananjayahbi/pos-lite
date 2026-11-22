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

## Multi-line address and footer (ARGUS #492)

The profile fields are textareas (address 3 rows, footer 4 rows), but the
browser and A4 receipts wrapped the whole value in one block, so a multi-line
address printed as a single line. Both renderers now use
`receiptContactLines` / `receiptFooterLines`:

- address lines become separate header rows (no `white-space` trick needed);
- the phone is appended as its own `Tel: ...` line;
- footer lines become separate centred rows on 80 mm and A4;
- ESC/POS splits the footer into one `line()` per stored line and prints the
  contact block the same way.

CRLF, LF and CR are all accepted and blank lines are dropped, so pasting a
Windows-formatted address from the profile form prints cleanly.
