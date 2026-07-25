# AyurPOS — Test Credentials

> All credentials below are seeded by `pnpm prisma db seed`.

---

## Super Admin
chat.
| Field    | Value                       |
| -------- | --------------------------- |
| Email    | `superadmin@ayurpos.dev`  |
| Password | `changeme123!`              |
| PIN      | `9999`                      |
| Role     | `SUPER_ADMIN`               |
| Lands on | `/superadmin/dashboard`     |

---

## Business 1 — Ayur Wellness Centre

### Owner

| Field    | Value                       |
| -------- | --------------------------- |
| Email    | `owner@dilani-ayurwellness.lk`  |
| Password | `owner123!`                 |
| PIN      | `1111`                      |
| Role     | `OWNER`                     |
| Business | Ayur Wellness Centre             |
| Lands on | `/dashboard`                |

### Cashiers

| Field    | cashier1                    | cashier2                    |
| -------- | --------------------------- | --------------------------- |
| Email    | `cashier1@ayurpos.dev`    | `cashier2@ayurpos.dev`    |
| Password | `cashier123!`               | `cashier123!`               |
| PIN      | `3333`                      | `4444`                      |
| Role     | `CASHIER`                   | `CASHIER`                   |
| Lands on | `/pos`                      | `/pos`                      |

---

## Business 2 — Lanka Electronics

### Owner

| Field    | Value                            |
| -------- | -------------------------------- |
| Email    | `owner@lanka-electronics.lk`     |
| Password | `owner123!`                      |
| PIN      | `2222`                           |
| Role     | `OWNER`                          |
| Business | Lanka Electronics                |
| Lands on | `/dashboard`                     |

### Cashier

| Field    | Value                              |
| -------- | ---------------------------------- |
| Email    | `cashier@lanka-electronics.lk`     |
| Password | `cashier123!`                      |
| PIN      | `3333`                             |
| Role     | `CASHIER`                          |
| Lands on | `/pos`                             |

---

## Notes

- The system is configured for exactly **2 businesses** (Ayur Wellness Centre and Lanka Electronics).
- Only the **Super Admin** can manage business settings (name, currency, tax rates, etc.) from the superadmin dashboard.
- Business creation is disabled — the system is limited to 2 businesses.
- PIN-based login (for POS access) uses the hashed PIN stored on the user record.
- Store profile settings have been moved to the superadmin dashboard.
