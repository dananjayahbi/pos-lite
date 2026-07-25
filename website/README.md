# Ruhunuwedagedara — Customer-Facing Storefront

This is the **customer-facing website** for Ruhunuwedagedara. It is a
separate Next.js application that consumes content from the AyurPOS
**ERP backend** over HTTP — it has no direct database access.

```
┌───────────────────────┐  HTTPS / JSON   ┌──────────────────────────┐
│  ruhunuwedagedara.lk  │ ◄──────────────►│  admin.ruhunuwedagedara  │
│  (this project, :3002)│                 │  (the ERP, :3003)        │
└───────────────────────┘                 └──────────────────────────┘
```

In production both apps sit behind the same reverse proxy on the same VPS,
so requests are fast (no extra DNS hops, no cross-region latency).

---

## Quick start

### 1. Add local hostnames

The storefront and the admin run on different (sub)domains. In production
you'll point DNS at your VPS; in development we use `/etc/hosts`:

```bash
sudo tee -a /etc/hosts <<'EOF'
127.0.0.1   ruhunuwedagedara.lk
127.0.0.1   admin.ruhunuwedagedara.lk
EOF
```

### 2. Install dependencies

```bash
yarn install
```

### 3. Configure environment

The default `.env.local` already points at the ERP dev server on
`admin.ruhunuwedagedara.lk:3003`. Adjust if your ERP runs elsewhere:

```env
NEXT_PUBLIC_API_BASE_URL=http://admin.ruhunuwedagedara.lk:3003
NEXT_PUBLIC_DEFAULT_TENANT_SLUG=ruhunuwedagedara
NEXT_PUBLIC_SITE_URL=http://ruhunuwedagedara.lk:3002
NEXT_PUBLIC_REVALIDATE_SECONDS=60
```

### 4. Start the dev server

```bash
# In this directory:
yarn dev          # picks the next free port

# Or pin to 3002:
yarn dev:3002
```

Visit:

| URL                                                | What it serves           |
| -------------------------------------------------- | ------------------------ |
| `http://ruhunuwedagedara.lk:3002/`                 | Default tenant storefront |
| `http://ruhunuwedagedara.lk:3002/<tenantSlug>`     | Specific tenant          |
| `http://admin.ruhunuwedagedara.lk:3003/dashboard`  | ERP admin (separate app) |

---

## How content flows

```
┌──────────────────────────────────────────────────────────────┐
│ Browser hits ruhunuwedagedara.lk:3002/<tenantSlug>           │
└──────────────────────────┬───────────────────────────────────┘
                           │
                           ▼
┌──────────────────────────────────────────────────────────────┐
│ Next.js server component (app/[tenantSlug]/page.tsx)        │
│   - Calls getTenantInfo / getPublicWebsiteConfig             │
│   - Calls getLatestProducts / getBestSellingProducts         │
│   - Calls getPublicCategories                                │
│   All in parallel, with ISR (60s revalidate).                │
└──────────────────────────┬───────────────────────────────────┘
                           │
                           ▼
┌──────────────────────────────────────────────────────────────┐
│ src/lib/api/client.ts → apiFetch() → ERP HTTP API            │
│   /api/public/site/<slug>/config                             │
│   /api/public/site/<slug>/tenant                             │
│   /api/public/site/<slug>/products?sort=latest&limit=10      │
│   /api/public/site/<slug>/products?sort=best-selling         │
│   /api/public/site/<slug>/categories                        │
│   /api/public/site/<slug>/brands                            │
└──────────────────────────┬───────────────────────────────────┘
                           │
                           ▼
┌──────────────────────────────────────────────────────────────┐
│ Prisma → PostgreSQL                                          │
└──────────────────────────────────────────────────────────────┘
```

The storefront never talks to the database directly. All reads go through
the public API, which enforces tenant-scoping and returns sanitised
payloads (Decimal → number, no internal IDs unless needed, etc.).

---

## Project structure

```
website/
├── src/
│   ├── app/
│   │   ├── layout.tsx               # root html + fonts
│   │   ├── globals.css              # site design tokens + component CSS
│   │   ├── page.tsx                 # / → redirects to default tenant
│   │   ├── not-found.tsx            # 404 fallback
│   │   └── [tenantSlug]/
│   │       ├── page.tsx             # storefront (server component)
│   │       ├── loading.tsx          # skeleton
│   │       └── error.tsx            # graceful failure UI
│   │
│   ├── components/
│   │   ├── website/
│   │   │   ├── WebsiteShell.tsx     # section orchestrator (client)
│   │   │   └── sections/            # 14 drop-in sections
│   │   │       ├── AdBanner.tsx
│   │   │       ├── BackToTop.tsx
│   │   │       ├── BestSelling.tsx
│   │   │       ├── CategoryGrid.tsx
│   │   │       ├── GiftBoxSection.tsx
│   │   │       ├── HeroSection.tsx
│   │   │       ├── LatestProducts.tsx
│   │   │       ├── PromoBanner.tsx
│   │   │       ├── ShopByConcern.tsx
│   │   │       ├── SolutionsByConcern.tsx
│   │   │       ├── StoresBanner.tsx
│   │   │       ├── TestimonialsSection.tsx
│   │   │       ├── WebsiteFooter.tsx
│   │   │       └── WebsiteHeader.tsx
│   │   └── ui/                      # shadcn primitives (add as needed)
│   │
│   ├── lib/
│   │   ├── api/
│   │   │   ├── client.ts            # fetch wrapper with Next cache + tags
│   │   │   ├── website.ts           # getPublicWebsiteConfig / getTenantInfo
│   │   │   ├── products.ts          # list + single + convenience helpers
│   │   │   ├── categories.ts
│   │   │   └── brands.ts
│   │   ├── utils.ts                 # cn() + formatLKR() + helpers
│   │   └── tenant.ts                # default slug resolution
│   │
│   ├── config/
│   │   └── site.ts                  # env-driven constants
│   │
│   ├── types/
│   │   └── website.types.ts         # mirrors ERP-side types
│   │
│   └── hooks/                       # (reserved for client hooks)
│
├── public/                          # static assets
├── package.json
├── tsconfig.json
├── next.config.ts
├── components.json                  # shadcn-style aliases
├── postcss.config.mjs               # Tailwind v4
├── prettier.config.mjs
├── eslint.config.mjs
├── next-env.d.ts
├── .env.local.example
└── README.md
```

---

## Conventions

- **Server-first**: every page is a server component. Only the section
  components and the `WebsiteShell` are `'use client'` so they can be
  interactive (slider, scroll, mobile menu).
- **Modular sections**: each section in `components/website/sections/`
  is self-contained — it accepts `{ config, websiteConfig, tenantSlug,
  ...optionalData }` and renders or returns `null`. To add a new
  section, create a new file, register it in `WebsiteShell.tsx`, and
  add its `SectionKey` to `types/website.types.ts`.
- **ERP is the source of truth**: hero slides, ads, navigation, footer
  columns, and product data are all configured in the ERP admin UI
  (`/settings/website`) and surface immediately (after ISR expires).
- **Graceful degradation**: if the ERP API is unreachable or returns an
  error, each section falls back to a safe placeholder / "off" state
  instead of crashing the whole page.

---

## Scripts

| Script             | Purpose                          |
| ------------------ | -------------------------------- |
| `yarn dev`         | Start dev server (free port)     |
| `yarn dev:3002`    | Start dev server on :3002        |
| `yarn build`       | Production build                 |
| `yarn start`       | Run production build             |
| `yarn start:3002`  | Run production build on :3002    |
| `yarn lint`        | ESLint (zero warnings allowed)   |
| `yarn typecheck`   | `tsc --noEmit`                   |
| `yarn format`      | Prettier write                   |

---

## Deployment

In production:

1. Build the ERP app and deploy to `admin.ruhunuwedagedara.lk` (port 3003
   behind nginx/caddy).
2. Build this storefront and deploy to `ruhunuwedagedara.lk` (port 3002
   behind nginx/caddy).
3. Set `NEXT_PUBLIC_API_BASE_URL` to the internal admin URL (e.g.
   `http://localhost:3003` if both apps share the VPS).
4. Nginx terminates TLS, proxies to each app on localhost, and serves
   the right host header so the ERP and storefront stay isolated.

The two apps share the same database (read-only for the storefront,
read/write for the ERP) and the same Cloudflare R2 bucket for media.