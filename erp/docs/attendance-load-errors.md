# Attendance page load errors

The attendance query used to call `res.json()` before checking `res.ok`. When
the API returned an HTML 404/403 page, the browser raised
`Unexpected token '<' ...` and the page still rendered zeroed Present/Absent
cards above a raw error (ARGUS #353).

## Response handling

`src/lib/api/safe-response.ts`:

- `readJsonBody(response)` reads the body as text and parses it without
  throwing. Empty and non-JSON bodies return `{ ok: false, value: null }`.
- `envelopeErrorMessage(body)` reads `error.message` from the standard API
  envelope, trims it and bounds it to 200 characters.
- `describeApiFailure({ ok, status, body, fallback })` returns:
  - `"<fallback> (<envelope message>)"` when the API supplied one;
  - `"<fallback> (HTTP <status>)"` for a non-JSON/empty body;
  - the fallback alone when the status was OK but the envelope was unsuccessful.

The attendance page checks `res.ok` and the parsed body before accepting data,
and uses the fallback `Attendance could not be loaded`. Raw response text and
parser errors are never shown.

## Page state

- While loading, the summary area shows skeleton cards.
- On error, a single **Attendance could not be loaded** card shows the human
  message and a **Retry** button that calls React Query's `refetch`.
- Zeroed summary cards, notices and the table are not rendered on error.
- The attendance calendar query uses the same safe reader.

## Verification

`src/lib/api/__tests__/safe-response.test.ts` covers JSON, HTML, empty and
throwing bodies, message trimming/bounding, and the human fallback for non-JSON
errors.
