# My Account test coverage

ARGUS #508. The Module 07 suite's S7 checked only that the heading rendered
(and its header still claimed `/settings/account` was a 404), while Modules 01
and 03 covered forgot-password and staff password resets - not this
self-service GET/POST. Nothing covered a successful change, session
invalidation, a wrong current password, rate limiting, bcrypt truncation, Clear
or the load-error state.

## Added

`tests/07_settings_taxes_hardware.spec.ts`:

| Case | Covers |
| --- | --- |
| S7a | profile card loads email, last sign-in and day-first 24-hour timestamps |
| S7b | wrong current password message, then Clear removes it and empties fields |
| S7c | mocked 500 on GET shows an error and Retry recovers the card |
| S7d | empty payload gives a friendly `VALIDATION_ERROR`; 80 ASCII chars and 24 four-byte emoji (72+ bytes) are rejected; new == current is rejected |
| S7e | a throwaway CASHIER changes their own password, the old cookie stops reading `/api/settings/account` (sessionVersion bump), then the account is deactivated |

Rate limiting itself remains covered by `src/lib/rate-limit`'s sliding-window
tests; the account route consumes the same limiter (documented in
`password-change-security.md`).

## Unit coverage

`src/lib/auth/__tests__/password-policy.core.test.ts` pins the byte cap
(including multi-byte input), minimum length, same-password and confirmation
rules that both the form and the API use.

## Verification

Playwright is not run by the module agent (needs the dev server). Targeted:
`npx vitest run src/lib/auth/__tests__/password-policy.core.test.ts` and
`npx tsc --noEmit`.
