# VelvetPOS — Test Credentials

> All credentials below are seeded by `pnpm prisma db seed` using the `.env.local` seed vars.

---

## Super Admin

| Field    | Value                       |
| -------- | --------------------------- |
| Email    | `superadmin@velvetpos.dev`  |
| Password | `changeme123!`              |
| Role     | `SUPER_ADMIN`               |
| Lands on | `/superadmin/dashboard`     |

---

## Store Owner — Dilani Boutique

| Field    | Value                       |
| -------- | --------------------------- |
| Email    | `owner@dilani-boutique.lk`  |
| Password | `owner123!`                 |
| Role     | `OWNER`                     |
| Tenant   | Dilani Boutique             |
| Lands on | `/dashboard`                |

---

## Cashiers — Dilani Boutique

| Field    | cashier1                    | cashier2                    |
| -------- | --------------------------- | --------------------------- |
| Email    | `cashier1@velvetpos.dev`    | `cashier2@velvetpos.dev`    |
| Password | `cashier123!`               | `cashier123!`               |
| Role     | `CASHIER`                   | `CASHIER`                   |
| Lands on | `/dashboard`                | `/dashboard`                |

---

## Demo Tenant Owners (Billing States)

| Email                              | Password              | Subscription State |
| ---------------------------------- | --------------------- | ------------------ |
| `demo-trial-owner@velvetpos.dev`   | `trial-demo-pass!`    | TRIAL (14 days)    |
| `demo-suspended-owner@velvetpos.dev` | `suspended-demo-pass!` | SUSPENDED        |

---

## Notes

- The `velvetdemo.com` users (`owner@velvetdemo.com`, `manager@velvetdemo.com`, etc.) are **not seeded** unless `SEED_DEMO_DATA=true` is set in `.env.local`.
- To enable the full comprehensive demo dataset, add `SEED_DEMO_DATA=true` to `.env.local` and re-run `pnpm prisma db seed`.
- PIN-based login (for cashiers at the POS terminal) uses the PIN stored on the user record — see `prisma/seed.ts` for values.
