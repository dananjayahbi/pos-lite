# VelvetPOS — Test Credentials

> All credentials below are seeded by `pnpm prisma db seed` using the `.env.local` seed vars.

---

## Super Admin

| Field    | Value                       |
| -------- | --------------------------- |
| Email    | `superadmin@velvetpos.dev`  |
| Password | `changeme123!`              |
| PIN      | `9999`                      |
| Role     | `SUPER_ADMIN`               |
| Lands on | `/superadmin/dashboard`     |

---

## Store Owner — Dilani Boutique

| Field    | Value                       |
| -------- | --------------------------- |
| Email    | `owner@dilani-boutique.lk`  |
| Password | `owner123!`                 |
| PIN      | `1111`                      |
| Role     | `OWNER`                     |
| Tenant   | Dilani Boutique             |
| Lands on | `/dashboard`                |

---

## Cashiers — Dilani Boutique

| Field    | cashier1                    | cashier2                    |
| -------- | --------------------------- | --------------------------- |
| Email    | `cashier1@velvetpos.dev`    | `cashier2@velvetpos.dev`    |
| Password | `cashier123!`               | `cashier123!`               |
| PIN      | `3333`                      | `4444`                      |
| Role     | `CASHIER`                   | `CASHIER`                   |
| Lands on | `/pos`                      | `/pos`                      |

---

## Demo Tenant Owners (Billing States)

| Email                                | Password                | PIN    | Subscription State |
| ------------------------------------ | ----------------------- | ------ | ------------------ |
| `demo-trial-owner@velvetpos.dev`     | `trial-demo-pass!`      | `6666` | TRIAL (14 days)    |
| `demo-suspended-owner@velvetpos.dev` | `suspended-demo-pass!`  | `7777` | SUSPENDED          |

---

## Notes

- The `velvetdemo.com` users (`owner@velvetdemo.com`, `manager@velvetdemo.com`, etc.) are **not seeded** unless `SEED_DEMO_DATA=true` is set in `.env.local`.
- To enable the full comprehensive demo dataset, add `SEED_DEMO_DATA=true` to `.env.local` and re-run `pnpm prisma db seed`.
- The current workspace database has been updated so the seeded test users above all have PINs configured.
- PIN-based login (for POS access) uses the hashed PIN stored on the user record.
- If `SEED_DEMO_DATA=true` is enabled, the extra demo-only `velvetdemo.com` users receive these seeded PINs from `prisma/seed.ts`: owner `1111`, manager `2222`, cashier1 `3333`, cashier2 `4444`, stock `5555`.
