# Courier credentials are encrypted at rest

`CourierAccount.password` and `.apiKey` were stored as clear text; the GET route
redacted them for the UI, but a database read or a backup exposed the live Trans
Express password (ARGUS #514).

## Storage format

`src/lib/courier/credentials.ts` stores secrets as
`enc:v1:<iv>.<tag>.<ciphertext>` using AES-256-GCM with a random 96-bit IV. The
existing `String?` columns hold the ciphertext, so **no schema change or
migration was needed**.

- Key material: `COURIER_CREDENTIALS_KEY`, falling back to `AUTH_SECRET` /
  `NEXTAUTH_SECRET` so deployments are not broken by a missing new variable.
  A dedicated key is recommended (rotating `AUTH_SECRET` makes existing courier
  ciphertext unreadable).
- Writes fail closed: `PUT /api/store/delivery/settings` returns 503
  `CREDENTIALS_ENCRYPTION_UNAVAILABLE` rather than saving plaintext when no key
  material exists.
- Reads pass legacy plaintext through so an existing account keeps working; the
  next save re-encrypts it when key material is available.
- Every auth path (`dispatch`, tracking, recovery, dry-run test, location sync)
  decrypts a copy via `decryptCourierAccount`; the row is never rewritten with
  plaintext.
- A malformed/tampered value throws and is surfaced as
  "Saved courier credentials could not be decrypted. Re-enter them..." instead
  of being sent to the courier.

## Residual risk

Rows written before this change stay plaintext until the account is saved once
(or re-seeded). There is no batch re-encryption migration because migrations are
out of scope for this batch; the lazy path covers normal operation.

## Verification

`src/lib/courier/__tests__/credentials.test.ts` covers round-trip encryption,
random IVs, legacy passthrough, tamper detection, missing-key fail-closed
behaviour and account decryption. Test secrets are generated at runtime.
