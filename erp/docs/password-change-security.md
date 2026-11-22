# Account password-change rate limiting and audit

`POST /api/settings/account` had no lockout and no failure trail: a stolen
session could guess the current password, wrong attempts returned a plain 400
with no audit, and success reused the forgot-password action (ARGUS #504).

- Each user/IP pair is limited to 5 current-password attempts per 15-minute
  sliding window (same limiter as login/forgot-password). Exhaustion returns
  **429** with `Retry-After` and writes `PASSWORD_CHANGE_THROTTLED`.
- A wrong current password records a failed attempt and writes
  `PASSWORD_CHANGE_FAILED` with actor, IP and user agent.
- Success clears the bucket and writes the distinct `PASSWORD_CHANGED` action
  (forgot-password resets keep `PASSWORD_RESET_COMPLETED`).

## Verification

`tsc` covers the route; the rate-limit module already has its own sliding-window
coverage. The new audit constants are used only here.
