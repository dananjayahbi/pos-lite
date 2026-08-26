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

## Notes

- The system is configured for exactly **2 businesses** (Ayur Wellness Centre and Lanka Electronics).
- Only the **Super Admin** can manage business settings (name, currency, tax rates, etc.) from the superadmin dashboard.
- Business creation is disabled — the system is limited to 2 businesses.
- Store profile settings have been moved to the superadmin dashboard.
