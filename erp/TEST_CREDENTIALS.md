# AyurPOS — Test Credentials

> All credentials below are seeded by `pnpm prisma db seed`.

---

## URLs (local dev)

Two separate Next.js apps run side by side. Both `.env` files are pre-wired for
the hostnames below, which are mapped to `127.0.0.1` in
`C:\Windows\System32\drivers\etc\hosts`:

```
127.0.0.1  ruhunuwedagedara.lk
127.0.0.1  admin.ruhunuwedagedara.lk
```

| App | Base URL | Port |
| --- | --- | --- |
| **ERP** (AyurPOS admin + API) | `http://admin.ruhunuwedagedara.lk:3003` | 3003 |
| **Website** (customer storefront) | `http://ruhunuwedagedara.lk:3002` | 3002 |

`http://localhost:3003` and `http://localhost:3002` reach the same two apps, so
either form works — but the **hostnamed** form is what the env files, default-tenant
resolution and `allowedDevOrigins` assume, so prefer it when anything behaves oddly.

Start them with (from each app folder):

```
erp/      npm run dev     # -> http://admin.ruhunuwedagedara.lk:3003
website/  npm run dev     # -> http://ruhunuwedagedara.lk:3002
```

### ERP — one host, tenant follows the signed-in account

The ERP has **no tenant segment in its URL**. There is a single host; which business
you see is determined by *which account you sign in with*.

| Page | URL (prefix `http://admin.ruhunuwedagedara.lk:3003`) |
| --- | --- |
| Sign in | `/login` |
| Dashboard (OWNER / MANAGER / STOCK_CLERK) | `/dashboard` |
| POS (CASHIER) | `/pos` |
| Inventory | `/inventory` |
| Sales / Orders | `/sales`, `/orders` |
| Customers / Suppliers | `/customers`, `/suppliers` |
| Categories / Brands | `/categories`, `/brands` |
| Promotions | `/promotions` |
| Stock control | `/stock-control` |
| Delivery (DISPATCH_STAFF) | `/delivery` |
| Expenses / Petty cash | `/expenses`, `/petty-cash` |
| Returns | `/returns` |
| Factory (FACTORY_MANAGER) | `/factory` |
| Appointments | `/appointments` |
| Reports | `/reports` |
| Staff | `/staff` |
| Settings | `/settings` |
| **Website CMS** | `/settings/website` |
| Billing | `/billing` |
| **Super Admin** (SUPER_ADMIN only) | `/superadmin/dashboard` |

> Signing in as `owner@dilani-ayurwellness.lk` puts you in **Ayur Wellness Centre**;
> signing in as `owner@lanka-electronics.lk` puts you in **Lanka Electronics** — same
> URLs, different tenant. A signed-out visit to any protected path 307-redirects to
> `/login` (a `307` for `/dashboard` is therefore correct, not a broken URL).

### Website — tenant slug IS in the URL

| Page | URL (prefix `http://ruhunuwedagedara.lk:3002`) |
| --- | --- |
| Default tenant home (bare root → `dilani`) | `/` |
| Tenant home (explicit) | `/dilani` |
| Lanka Electronics home | `/lanka-electronics` |
| Shop | `/dilani/shop` |
| Product | `/dilani/product/<productId>` |
| Category | `/dilani/category/<categoryId-or-slug>` |
| About / Contact / Appointments | `/dilani/about`, `/dilani/contact`, `/dilani/appointments` |
| Cart | `/dilani/cart` |
| Checkout | `/dilani/checkout` |
| Checkout return (PayHere) | `/dilani/checkout/return?order=<orderRef>` |
| Order tracking | `/dilani/track` |

> `NEXT_PUBLIC_DEFAULT_TENANT_SLUG=dilani`, so the bare root `/` renders the
> `dilani` storefront.

---

## Super Admin

| Field    | Value                       |
| -------- | --------------------------- |
| Email    | `superadmin@ayurpos.dev`  |
| Password | `changeme123!`              |
| Role     | `SUPER_ADMIN`               |
| Lands on | `/superadmin/dashboard`     |

---

## Business 1 — Ayur Wellness Centre

> Tenant slug `dilani` → storefront `http://ruhunuwedagedara.lk:3002/dilani`
> (also the default tenant, so `/` renders it). This is the tenant with the
> Website CMS configured.

### Owner

| Field    | Value                       |
| -------- | --------------------------- |
| Email    | `owner@dilani-ayurwellness.lk`  |
| Password | `owner123!`                 |
| Role     | `OWNER`                     |
| Business | Ayur Wellness Centre             |
| Lands on | `/dashboard`                |

### Cashiers

| Field    | cashier1                    | cashier2                    |
| -------- | --------------------------- | --------------------------- |
| Email    | `cashier1@ayurpos.dev`    | `cashier2@ayurpos.dev`    |
| Password | `cashier123!`               | `cashier123!`               |
| Role     | `CASHIER`                   | `CASHIER`                   |
| Lands on | `/pos`                      | `/pos`                      |

---

## Business 2 — Lanka Electronics

> Tenant slug `lanka-electronics` → storefront `http://ruhunuwedagedara.lk:3002/lanka-electronics`
> (not the default tenant, so the bare `/` does **not** render it).

### Owner

| Field    | Value                            |
| -------- | -------------------------------- |
| Email    | `owner@lanka-electronics.lk`     |
| Password | `owner123!`                      |
| Role     | `OWNER`                          |
| Business | Lanka Electronics                |
| Lands on | `/dashboard`                     |

### Cashier

| Field    | Value                              |
| -------- | ---------------------------------- |
| Email    | `cashier@lanka-electronics.lk`     |
| Password | `cashier123!`                      |
| Role     | `CASHIER`                          |
| Lands on | `/pos`                             |

---

## Business 1 — Dispatch Staff (Delivery Module)

### Dispatch Staff

| Field    | Value                          |
| -------- | ------------------------------ |
| Email    | `dispatch@ayurpos.dev`         |
| Password | `dispatch123!`                 |
| Role     | `DISPATCH_STAFF`               |
| Business | Ayur Wellness Centre           |
| Lands on | `/delivery`                    |

> The `delivery` module is enabled by default on the Ayur Wellness Centre tenant via the seed. To enable it on the other tenant, use the Super Admin → Tenant → Feature Modules toggle.

---

## Business 1 — Additional Roles (M03-08 verification accounts)

Known-password accounts for the roles that previously had none, so
FACTORY_MANAGER isolation and MANAGER / STOCK_CLERK scoping are
browser-verifiable (req 2.4 Roles 2–3). All land on the Ayur Wellness Centre
tenant and are repaired (hash/role/active/tenant) on every `prisma db seed`.

| Field    | manager                   | stockclerk                   | factory                   |
| -------- | ------------------------- | ---------------------------- | ------------------------- |
| Email    | `manager@ayurpos.dev`     | `stockclerk@ayurpos.dev`     | `factory@ayurpos.dev`     |
| Password | `manager123!`             | `stock123!`                  | `factory123!`             |
| Role     | `MANAGER`                 | `STOCK_CLERK`                | `FACTORY_MANAGER`         |
| Lands on | `/dashboard`              | `/dashboard`                 | `/factory`                |

> `FACTORY_MANAGER` is denied `/pos`, `/sales`, `/returns`, `/reports`,
> `/customers`, `/expenses`, `/billing`, `/staff`, and
> `/delivery/reconciliation` (see `FACTORY_FORBIDDEN_PATH_PREFIXES` in
> `src/proxy.ts`) — direct-URL attempts bounce to `/factory`.

---

## Staff password lifecycle (M03-08 / GAP-2)

Newly created staff accounts get an unusable random password server-side.
To make an account sign-in-capable, an OWNER/MANAGER with `staff:manage`
either supplies an **Initial Password** in the create dialog, or calls
`POST /api/store/staff/<id>/password` with `{ "newPassword": "..." }` (≥8
chars). Setting a password bumps the account's `sessionVersion`, so any live
session of that user is terminated on their next request.

---

## Notes

- The system is configured for exactly **2 businesses** (Ayur Wellness Centre and Lanka Electronics).
- Only the **Super Admin** can manage business settings (name, currency, tax rates, etc.) from the superadmin dashboard.
- Business creation is disabled — the system is limited to 2 businesses.
- Store profile settings have been moved to the superadmin dashboard.
