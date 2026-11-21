# Movement CSV is safe from formula injection (ARGUS #201)

Product names, SKUs, variant text, actor emails and movement notes are
user-entered. A value beginning with `=`, `+`, `-` or `@` (or with a tab/CR that
some importers strip) is interpreted as a formula when the exported CSV is
opened in Excel or Google Sheets.

## Behaviour

`neutralizeCsvFormula` in `src/lib/export.ts` prefixes a single apostrophe to a
string that begins with one of those characters; the leading apostrophe forces
spreadsheet software to treat the cell as text. It is applied before
`csvCell`/`toCsvLines` quoting, so a neutralised value that also contains a
comma or quote is still RFC-4180-escaped:

| Input | CSV cell |
| ----- | -------- |
| `=1+1` | `'=1+1` |
| `=cmd,1` | `"'=cmd,1"` |
| `-3` (number) | `-3` |

Only strings are neutralised. Numeric columns such as the signed quantity delta
are data and are left alone; callers opt in per text column with
`neutralizeCsvFormula` (or `csvTextCell` when a whole cell is text).

The movement CSV applies it to Product, SKU, Form, Pack Size, Actor and Note.
Enum-derived fields (reason, source type, ids) are system-controlled and do not
need it.

Tests: `src/lib/__tests__/csv-formula.test.ts`.
