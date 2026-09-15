# AyurPOS — Test Credentials

> All credentials below are seeded by `pnpm prisma db seed`.

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
