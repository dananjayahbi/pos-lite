# PayHere Integration — Implementation Reference

**Status:** canonical · **Owner:** website/ERP payments · **Last verified:** 2026-09-27
**Upstream sources:** `REFERENCES/payhere/scrapes/` (mirror of support.payhere.lk),
sandbox credentials in `REFERENCES/payhere/creds.txt` (never committed).

This document is the single vocabulary for our PayHere integration. It records the
**field contract**, the **two signatures** (they are different — see §3), the
**status contract**, and where each piece of code lives. Every claim below is
traceable to a scraped page; the page is named at the end of each section.

---

## 1. Environment matrix

| Env var | App | Purpose |
|---|---|---|
| `PAYHERE_SANDBOX` | ERP | `"true"` routes every URL to the sandbox host |
| `PAYHERE_MERCHANT_ID` | ERP | Merchant ID (same for sandbox and live) |
| `PAYHERE_MERCHANT_SECRET` | ERP | Domain/app-scoped secret; seeds **both** signatures |
| `PAYHERE_APP_ID` / `PAYHERE_APP_SECRET` | ERP | REST API credentials (retrieval, refund…) |
| `WEBSITE_URL` | ERP | Storefront origin used for `return_url` / `cancel_url` |
| `NEXT_PUBLIC_PAYHERE_ENABLED` | website | Show the card option only when the gateway is live |

> The merchant secret is **specific to a domain/app**. `localhost` is a registered
> domain/app in our sandbox account, which is why browser-initiated checkout works
> from `http://localhost:3002`. A new domain needs a new secret via the Merchant
> Portal (*Integrations → Add Domain/App → Request to Allow*, up to 24 h approval).

**Registered values (sandbox):** domain `localhost`, Merchant ID `1238284`.
The secret is base64 in `creds.txt`; the live secret will differ (different domain).

*Source: Checkout API §Prerequisites; `REFERENCES/payhere/info.txt`.*

### 1.1 Hosts

| | Redirect checkout | JS SDK script |
|---|---|---|
| Sandbox | `https://sandbox.payhere.lk/pay/checkout` | `https://sandbox.payhere.lk/lib/payhere.js` |
| Live | `https://www.payhere.lk/pay/checkout` | `https://www.payhere.lk/lib/payhere.js` |

> ⚠️ The **live** host must include `www`; omitting it returns `PH-0022`.

---

## 2. Checkout redirect contract

We POST `application/x-www-form-urlencoded` hidden fields to the action URL from the
browser. **Required** fields:

| Field | Notes |
|---|---|
| `merchant_id` | from config |
| `return_url` | browser redirect after an **approved** payment |
| `cancel_url` | browser redirect when the customer cancels |
| `notify_url` | server-to-server callback; must be publicly reachable |
| `first_name`, `last_name` | split from the customer's full name |
| `email` | **must be a valid email format** |
| `phone` | **must be a valid phone number** |
| `address`, `city`, `country` | address line 1+2, city, country |
| `order_id` | our order identifier (we use the `Delivery` id) |
| `items` | item title / order number |
| `currency` | `LKR` or `USD` |
| `amount` | total; **two decimals** (`number_format($amount, 2, '.', '')`) |
| `hash` | **required since 2023-01-16** — see §3.1 |

Useful optional fields we send:

| Field | Notes |
|---|---|
| `delivery_address`, `delivery_city`, `delivery_country` | separate delivery address |
| `item_name_n`, `item_number_n`, `amount_n`, `quantity_n` | per-line items, numbered from 1 |
| `custom_1`, `custom_2` | merchant payload, echoed back on the IPN |
| `payment_method` | pre-select a method, bypassing the selection screen |

> **No payment-status data is returned to `return_url`.** It is only a browser
> redirect. The authoritative outcome arrives at `notify_url`, so the confirmation
> page must read the status from **our database**, never from the query string.

> `payment_method` hints (docs list): `VISA`, `MASTER`, `AMEX`, `HELAPAY`, `FRIMI`,
> `QPLUS`. If omitted, the customer chooses on the PayHere screen — which is our
> default, and the only way to expose every method the merchant account enables.
> **LANKAQR is not a documented `payment_method` value for this checkout API.**

*Source: Checkout API §Integration 1 (required/optional params, HTML form sample).*

---

## 3. The two signatures (they are NOT the same)

Both use MD5 and the same uppercased-secret inner hash, but the outer concatenation
differs by **`status_code`**. Getting this wrong is silent: the checkout refuses the
payment, or the IPN gate rejects every real notification.

Shared inner hash:

```
innerHash = UPPER(MD5(merchant_secret))
```

⚠ **Uppercase applies to the hex DIGEST, not to the secret.** `MD5(secret)` is
computed first, and its output is then upper-cased — **not** `MD5(secret.toUpperCase())`.
The two produce different values whenever the secret contains a lowercase letter,
and PayHere answers *Unauthorized payment request* for the wrong one. Every language
sample on the vendor's page confirms the digest is what gets upper-cased:

| Language | Sample |
|---|---|
| PHP | `strtoupper(md5($merchant_secret))` |
| JavaScript | `md5(merchantSecret).toString().toUpperCase()` |
| .NET | `ComputeMD5(...)` appending `"{b:X2}"` (uppercase hex) |
| Java | `getMd5(...)` then `hashtext.toUpperCase()` |

That last point is easy to miss precisely because this is the *same shape* of
trap as §3's `status_code`: a formulation that is arithmetically plausible,
passes a self-derived test, and is rejected by the live gateway.

### 3.1 `hash` — sent **to** PayHere with the checkout form

```
hash = UPPER(MD5(merchant_id + order_id + amount + currency + innerHash))
```

- `amount` **must match** the submitted `amount` exactly (2 decimals).
- **Must be generated server-side** — putting the secret in the browser leaks it.

### 3.2 `md5sig` — received **from** PayHere on the IPN

```
md5sig = UPPER(MD5(merchant_id + order_id + payhere_amount + payhere_currency + status_code + innerHash))
```

- Uses the gateway's own `payhere_amount` / `payhere_currency` strings **verbatim**.
- Verify it **before** acting on the notification; a notification that fails
  verification may have been forged by a third party claiming success.
- Only treat a payment as successful when the signature matches **and**
  `status_code == 2`.

> Both hashes are compared case-insensitively in our implementation (the gateway
> transmits uppercase hex; we normalise both sides).

*Source: Checkout API §§Generating 'hash' Value, 3. Verifying the Payment Status.*

---

## 4. Status contract

`status_code` on the IPN → our `OrderPaymentStatus`:

| Code | PayHere meaning | Our status | Delivery effect |
|---|---|---|---|
| `2` | success | `PAID` | order becomes dispatchable |
| `0` | pending | `FAILED`† | none |
| `-1` | cancelled | `FAILED`† | none |
| `-2` | failed | `FAILED` | none |
| `-3` | chargedback | `REFUNDED` | none |

† We map `0`/`-1` to `FAILED` because our enum has no `PENDING`-after-attempt state;
`PENDING` is the *initial* state. A later `2` still promotes the order to `PAID`
(the update is idempotent and never downgrades a paid order).

Implementation: `erp/src/lib/payments/payhere-status.ts`.

### 4.1 Other IPN fields we may consume

| Field | Use |
|---|---|
| `payment_id` | PayHere's unique payment id → store on the order |
| `method` | the method actually used (`VISA`, `MASTER`, `GENIE`, `EZCASH`, …) |
| `status_message` | gateway message; log only, never shown raw to the customer |
| `card_holder_name`, `card_no`, `card_expiry` | masked card data, present for card payments |
| `custom_1`, `custom_2` | our own routing payload, echoed back |

We encode routing in `custom_2` with a discriminator:

| `custom_2` | Meaning |
|---|---|
| `order:<deliveryId>` | customer (storefront) order |
| a bare subscription id | SaaS subscription invoice |

*Source: Checkout API §Integration 2 (POST params, status codes).*

---

## 5. Behaviour rules and traps

1. **Always answer the IPN with HTTP 200.** PayHere retries non-2xx responses, so we
   express rejection in the **body** (`{received:false, reason}`) and never via a
   status code.
2. **Gate before any DB access.** A forged notification must create zero rows. The
   signature check runs first in the route; only verified payloads reach the ledger.
3. **`notify_url` cannot be `localhost`.** PayHere's servers must reach it, so local
   webhook testing needs a tunnel (ngrok / Cloudflare Tunnel) and the tunnel host
   added to the allowed-domain list.
4. **The form body is `application/x-www-form-urlencoded`, not JSON.**
5. **Initiate from the registered domain** and send a `Referer` header (avoid
   `no-referrer`) or PayHere answers *Unauthorized Payment Request*.
6. **Only one integration record per domain** in the Merchant Portal; duplicates
   cause validation failures.
7. **Reject unsupported content** in parameter values (emoji, script tags) — PayHere
   answers *Something Went Wrong*.
8. **HelaPay needs valid contact details** (email + phone) or it errors.
9. Each `order_id` is single-use in practice; our `order_id` is the `Delivery` id, and
   the IPN handler is idempotent.

*Source: Checkout API §Integration 2/3/4; Sandbox & Testing.*

---

## 6. Sandbox testing

Test cards (any valid name/CVV/expiry):

| Outcome | Visa | MasterCard | AMEX |
|---|---|---|---|
| Success | `4916217501611292` | `5307732125531191` | `346781005510225` |
| Insufficient funds | `4024007194349121` | `5459051433777487` | `370787711978928` |
| Limit exceeded | `4929119799365646` | `5491182243178283` | `340701811823469` |
| Do not honor | `4929768900837248` | `5388172137367973` | `374664175202812` |
| Network error | `4024007120869333` | `5237980565185003` | `373433500205887` |

**Any other card number fails.** Sandbox payments are simulated — no money moves.

*Source: Sandbox & Testing.*

---

## 7. Code map

| Concern | File |
|---|---|
| Config (hosts, creds, `isPayhereConfigured`) | `erp/src/lib/payments/payhere-config.ts` |
| Signatures (§3) | `erp/src/lib/payments/payhere-crypto.ts` |
| Payload builders (redirect, JS SDK) | `erp/src/lib/payments/payhere-payload.ts` |
| Status map (§4) | `erp/src/lib/payments/payhere-status.ts` |
| Order payment service | `erp/src/lib/services/order-payment.service.ts` |
| IPN route | `erp/src/app/api/webhooks/payhere/route.ts` |
| Public payment-status read | `erp/src/app/api/public/site/[tenantSlug]/orders/[orderRef]/payment/route.ts` |
| Storefront redirect helper | `website/src/lib/payhereRedirect.ts` |
| Storefront return UX | `website/src/components/website/checkout/PaymentReturnBanner.tsx` |

## 8. Open items (deliberately deferred)

- **LANKAQR** — no documented `payment_method` value for this checkout API. Whether
  it is available at all depends on the merchant account and is toggled by PayHere,
  not by our payload. Tracked as a client-requirement question, not a code task.
- **Wallets** (`EZCASH`, `MCASH`, `GENIE`, `VISHWA`, `PAYAPP`, `HNB`) appear only as
  **IPN `method`** values; we display the method that was used. Enabling them is a
  merchant-account concern.
- **Chargebacks** (`-3`) — we record `REFUNDED` and surface it on the order; there is
  no automated dispute workflow.
- **Mobile SDKs** (Android / iOS / React Native / Flutter) — not applicable to this
  system; scraped for completeness only.
- **Recurring / preapproval / charging / subscription-manager APIs** — relevant only
  if SaaS billing moves to stored-card auto-charging. Currently the SaaS leg uses the
  same redirect checkout per invoice.
