# Stock movement export failures

ARGUS #202.

The Export CSV handler caught every failure and only cleared the spinner, so a
404 / 500 / network error left the operator with no file and no explanation.

The handler now:

- reads the JSON error envelope when the response is not `ok` and rethrows its
  `error.message` (falling back to "Failed to export stock movements");
- shows `toast.error` with that message and keeps the button enabled for retry;
- shows `toast.success` only after the file download is triggered.

The server route is unchanged: it still validates `from`/`to`, filters by tenant
and returns the standard envelope. Export errors stay visible rather than
looking like a click that did nothing.
