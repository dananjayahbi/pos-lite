# Task 01.02.11 — Implement Auth Rate Limiting

## Metadata

- **Sub-Phase:** 01.02 — Authentication, RBAC & Session Management
- **Phase:** 01 — The Foundation
- **Estimated Complexity:** Medium
- **Dependencies:** Task_01_02_02 (Credentials provider in auth.ts; PIN route handler in api/auth/pin/route.ts)

---

## Objective

Create an in-memory sliding window rate limiter module, apply it to the login and PIN authentication endpoints, and ensure that exceeding the limit returns an appropriate error without leaking internal implementation details to the caller.

---

## Instructions

### Step 1: Understand the Rate Limiting Approach

VelvetPOS uses an in-memory sliding window rate limiter for authentication endpoints. This approach is chosen because: it requires no additional infrastructure (no Redis or external service needed for initial deployment), it is zero-latency compared to a network-based store, and the risk surface of brute-force attacks is contained to the authentication endpoints only.

The known limitation of in-memory rate limiting is that it does not share state across multiple server processes or serverless function instances. On Vercel with concurrent function instances, each instance maintains its own counter, meaning the effective limit per user could be multiplied by the number of active instances. In practice, for a retail POS system with predictable traffic volumes, this is acceptable. If the deployment scales to many thousands of users, a Redis-backed limiter (using Upstash Redis or similar) should replace this implementation at that time.

### Step 2: Create the Rate Limiter Module

Create the file src/lib/rate-limit.ts. This file must be a pure server-side module and must not be imported into any Client Component.

The rate limiter uses a module-level Map where keys are strings (rate limit bucket identifiers) and values are arrays of numbers (Unix timestamps in milliseconds representing the times of recent attempts). This structure allows an accurate sliding window calculation.

Export a function named checkRateLimit. The function accepts two parameters: ip (a string — the caller's IP address) and key (a string prefix that distinguishes between different rate-limited endpoints — for example "login" or "pin"). The function also accepts two optional parameters: maxAttempts defaulting to 10 and windowMs defaulting to 900000 (15 minutes in milliseconds).

The function's logic should be: construct the full bucket key by joining the key prefix and IP with a colon separator. Retrieve the array of timestamps for that bucket from the Map (or initialize an empty array if not present). Filter the array to keep only timestamps that are within the windowMs sliding window from the current time (discard old entries). The count of remaining timestamps after this filter is the number of attempts in the current window. If the count is greater than or equal to maxAttempts, compute the resetAt time as the oldest timestamp in the filtered array plus windowMs (the moment when the window will have fully slid past the first recorded attempt). Return an object with allowed: false, remaining: 0, and resetAt as a Date object.

If the count is below maxAttempts, append the current timestamp to the array, store the updated array back in the Map, and return an object with allowed: true, remaining: maxAttempts minus the new count, and resetAt as a Date calculated the same way.

Export the return type as a TypeScript interface named RateLimitResult with the three fields: allowed (boolean), remaining (number), and resetAt (Date).

Also export a function named recordFailedAttempt that increments the counter without a preceding allowed check. This is used in the PIN login route where Zod validation passes but the bcrypt comparison fails — the attempt should be counted even when called from a path that already checked the limit.

### Step 3: Apply Rate Limiting to the Credentials Provider

Open src/lib/auth.ts. In the authorize function, before performing any Zod validation or database query, extract the client IP address using the getClientIp helper from the request object. Call checkRateLimit with the extracted IP and the key "login". If the result's allowed property is false, throw a CredentialsSignin error with the message "TOO_MANY_ATTEMPTS". Do not proceed to any Zod validation or database call — return immediately with the rate limit error. This ensures that a blocked IP cannot use the authorize function to probe the database at all.

The login page (Task 01.02.03) already maps the "TOO_MANY_ATTEMPTS" error code to a user-friendly message. Confirm that the error is surfaced correctly on the login page: the message should read something like "Too many login attempts. Please wait 15 minutes before trying again." along with an approximate reset time derived from the resetAt value if it can be passed through to the client.

### Step 4: Apply Rate Limiting to the PIN Route Handler

Open src/app/api/auth/pin/route.ts. At the beginning of the POST handler, after extracting the IP address, call checkRateLimit with the key "pin". If not allowed, return a 429 JSON response with a body containing an error field with the message "Too many PIN attempts. Please wait before trying again." and a resetAt field with the ISO string representation of the resetAt Date. Do not proceed to Zod validation or any database query.

After a failed PIN verification (bcrypt.compare returns false or user not found), call recordFailedAttempt for the "pin" key and the client IP so the failure is counted against the rate limit even though the initial checkRateLimit check may have allowed the request.

### Step 5: Ensure Consistent Error Responses

Review all rate-limit-related error paths and ensure the response messages do not reveal whether the rate limit was triggered by login attempts or PIN attempts to a casual observer. The message should be generic enough to convey "slow down" without revealing internal key naming conventions or exact window parameters.

Ensure that successful authentication attempts do not consume a rate limit slot. The checkRateLimit function as described in Step 2 always records the attempt (both allowed and disallowed). Consider making the recording behavior configurable with an optional recordOnCall boolean parameter (defaulting to true). This allows the Credentials authorize function to check the limit without recording a new slot for a successful login, resetting the window to give legitimate users a clean slate. Alternatively, keep the simpler always-record behavior that is still well within acceptable limits for legitimate users who typically make fewer than 10 login attempts per 15 minutes.

### Step 6: Add Cleanup for the In-Memory Store

The module-level Map grows indefinitely if not cleaned up. Add a periodic cleanup mechanism: use a setInterval registered once at module initialization time with an interval of 60 minutes. The cleanup function iterates over all entries in the Map and removes entries whose timestamp arrays are entirely outside the sliding window (meaning the bucket has been idle for a full window period). This prevents unbounded memory growth from accumulated historical IP entries.

Guard the setInterval registration inside a check for typeof globalThis.setInterval !== "undefined" to avoid issues in environments where setInterval may not be available.

### Step 7: Document the Rate Limiter Limits

Add a comment block at the top of src/lib/rate-limit.ts documenting the rate limiting policy:

- Login endpoint: 10 attempts per IP per 15-minute sliding window
- PIN endpoint: 10 attempts per IP per 15-minute sliding window
- Forgot password endpoint: 5 attempts per IP per 60-minute window (applied in Task 01.02.07)
- Window type: sliding (not fixed) — the window is calculated from the time of the first attempt, not the start of a clock period

This comment serves as the authoritative documentation for the rate limiting policy throughout the codebase.

---

## Expected Output

- src/lib/rate-limit.ts implements a sliding window rate limiter using an in-memory Map
- checkRateLimit returns a RateLimitResult with allowed, remaining, and resetAt
- The login Credentials provider checks the rate limit before any Zod validation or database access
- The PIN route handler checks the rate limit and returns HTTP 429 when exceeded
- Failed PIN verifications call recordFailedAttempt to count the failed attempt
- The in-memory Map has a periodic cleanup to prevent unbounded growth
- The rate limiting policy is documented in a comment at the top of the file

---

## Validation

- [ ] Making 10 login attempts with an invalid password succeeds (returns auth error, not rate limit)
- [ ] The 11th login attempt within 15 minutes from the same IP returns the "TOO_MANY_ATTEMPTS" error
- [ ] The 11th login attempt does not reach Zod validation or the database (checked via logs or debugger)
- [ ] Making 10 PIN attempts returns a per-attempt 401 response
- [ ] The 11th PIN attempt returns HTTP 429 with a resetAt value in the response body
- [ ] The login page shows a user-friendly message for the "TOO_MANY_ATTEMPTS" error code
- [ ] A successful login after the window expires is not blocked
- [ ] The in-memory Map cleanup function runs without errors
- [ ] pnpm tsc --noEmit passes without errors in rate-limit.ts and all files that import it

---

## Notes

- The sliding window algorithm used here (tracking individual timestamps) is more accurate than a fixed window counter but uses slightly more memory per bucket. For a POS system with a limited number of concurrent users, this is not a concern.
- The in-memory rate limiter resets on every server process restart or cold start. This means a sustained attacker could theoretically restart their attack window by triggering a cold start (for example, by waiting for a serverless instance to scale down). This is a known limitation of in-memory limiters. Accept this limitation for Phase 1 and note that a Redis-backed limiter should be adopted if the threat model requires more resilience.
- The checkRateLimit function should record the attempt immediately even if allowed, so that the remaining count in the response accurately reflects how many attempts are left. Some implementations only record on failure — avoid this pattern here as it makes the remaining count misleading to callers.
- Do not expose the resetAt timestamp in error messages on the login page in a way that helps an attacker time their next burst of attempts precisely. A rounded human-readable approximation ("Try again in about 15 minutes") is preferable to a precise timestamp.
- Do not apply rate limiting to successful authenticated API calls — only to unauthenticated credential submission endpoints. The rate limiter module should never be imported into server-side data-fetching functions or TanStack Query loaders.
