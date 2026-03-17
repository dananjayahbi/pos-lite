# SubPhase 01.01 — Project Setup & Configuration

## Metadata

| Field | Value |
|---|---|
| Phase | Phase 01 — The Foundation |
| Sub-Phase | SubPhase 01.01 — Project Setup & Configuration |
| Status | Not Started |
| Dependencies | None |

## Objective

SubPhase 01.01 establishes the complete technical foundation for VelvetPOS. This sub-phase transforms an empty repository into a fully configured, standards-compliant Next.js 15+ application with all core tooling, design system tokens, database connectivity, and project structure in place.

The goal is to produce a project skeleton that every subsequent sub-phase can build upon without revisiting foundational decisions. Upon completion, the codebase will already enforce TypeScript strict mode, a consistent design language through Tailwind CSS tokens and ShadCN components, and professional developer-experience tooling through ESLint, Prettier, and Husky pre-commit hooks.

## Scope

### In Scope

- Initialising a new Next.js 15+ project with TypeScript strict mode, pnpm as the package manager, and the App Router
- Installing and connecting Prisma ORM to a managed PostgreSQL database
- Configuring Tailwind CSS 4 with the full VelvetPOS design token set: all six brand colours, six semantic colours, custom typography scale, and spacing overrides
- Installing ShadCN/UI and re-skinning the core component set to use VelvetPOS tokens exclusively — no generic grey colours permitted
- Configuring ESLint with Next.js + TypeScript strict rules, Prettier with project-wide formatting standards, and Husky lint-staged pre-commit hooks
- Creating the complete canonical directory structure as defined in Section 4 of 00_Project_Overview.md, including .gitkeep placeholders for empty leaf directories
- Configuring tsconfig.json for full strict mode and the @/ path alias mapped to ./src/
- Downloading and self-hosting the three project fonts (Playfair Display, Inter, JetBrains Mono) via next/font with CSS variable exports
- Creating the root and route-group layout shells for (store), (superadmin), and (auth) route groups
- Wiring TanStack Query (QueryClientProvider) and Zustand store skeletons into the root layout
- Creating the prisma/seed.ts scaffold as a placeholder for future data seeding
- Creating .env.example with all required environment variable definitions and a comprehensive README.md

### Out of Scope

- Defining any Prisma data models or database schema beyond the generator and datasource blocks
- Implementing any business logic, pages, or API routes
- Configuring NextAuth.js (handled in SubPhase 01.02)
- Implementing any actual page UI, store features, or POS functionality
- Writing any unit, integration, or end-to-end tests
- Seeding any actual data into the database
- Configuring CI/CD pipelines or deployment environments

## Technical Context

VelvetPOS is built on Next.js 15 with the App Router, which organises routes under the src/app/ directory using filesystem-based routing and route groups enclosed in parentheses. The project uses pnpm as its package manager for its superior monorepo support and disk-space efficiency through content-addressable storage.

The design system is implemented through Tailwind CSS 4's configuration layer, where custom CSS custom property variables are defined in the global stylesheet and then referenced inside tailwind.config.ts as extend.colors entries. This two-layer approach ensures that the tokens are available both as raw CSS variables (for JavaScript runtime access) and as Tailwind utility classes (for JSX className usage). The six primary brand colours and six semantic colours are listed below.

| Token Name | Hex Value | Intended Usage |
|---|---|---|
| espresso | #3A2D28 | Sidebar background, primary button fill |
| terracotta | #A48374 | Secondary accent, hover state overlays |
| sand | #CBAD8D | Button borders, active state indicators |
| mist | #D1C7BD | Divider lines, input field borders |
| linen | #EBE3DB | Page backgrounds, card backgrounds |
| pearl | #F1EDE6 | Main content area background |
| success | #4CAF50 | Success badges, positive feedback |
| warning | #FF9800 | Warning states, low stock indicators |
| danger | #F44336 | Error states, destructive actions |
| info | #2196F3 | Informational badges and callouts |
| text-primary | #1A1210 | Main body text |
| text-muted | #6B5E58 | Secondary, placeholder, helper text |

Typography is provided by three self-hosted font families: Playfair Display (used for display headings and large titles), Inter (used for all body text and UI elements), and JetBrains Mono (used exclusively for SKUs, barcodes, and machine-readable codes). All fonts are loaded via Next.js's built-in next/font module from the /public/fonts/ directory and exposed as CSS custom property variables.

ShadCN/UI is installed using the shadcn CLI initialiser, which scaffolds component files directly into the src/components/ui/ directory. Each component is then modified to reference the VelvetPOS tokens rather than the default ShadCN CSS variable palette. This ensures brand consistency throughout the entire application.

## Task List

| Task ID | Task Name | Estimated Complexity | Dependencies |
|---|---|---|---|
| Task_01_01_01 | Initialize_NextJS_Project | Low | None |
| Task_01_01_02 | Configure_Prisma_And_PostgreSQL | Medium | Task_01_01_01 |
| Task_01_01_03 | Setup_Tailwind_Design_Tokens | Medium | Task_01_01_01 |
| Task_01_01_04 | Install_ShadCN_And_Theme | Medium | Task_01_01_03 |
| Task_01_01_05 | Configure_ESLint_And_Prettier | Low | Task_01_01_01 |
| Task_01_01_06 | Create_Directory_Structure | Low | Task_01_01_01 |
| Task_01_01_07 | Configure_TypeScript_Strict_Mode | Low | Task_01_01_01 |
| Task_01_01_08 | Setup_Fonts_And_Assets | Low | Task_01_01_03 |
| Task_01_01_09 | Create_Global_Layout_Shell | Medium | Task_01_01_04, Task_01_01_08 |
| Task_01_01_10 | Setup_TanStack_Query_And_Zustand | Low | Task_01_01_09 |
| Task_01_01_11 | Configure_Prisma_Seed_Script | Low | Task_01_01_02 |
| Task_01_01_12 | Create_Env_Config_And_Readme | Low | Task_01_01_01 |

## Validation Criteria

- [ ] Running "pnpm dev" starts the development server without errors on port 3000
- [ ] Running "pnpm tsc --noEmit" completes with zero errors on the project skeleton
- [ ] Running "pnpm eslint src/" completes with zero warnings and zero errors
- [ ] Running "pnpm prettier --check ." reports no formatting violations
- [ ] All 12 colour tokens (espresso, terracotta, sand, mist, linen, pearl, success, warning, danger, info, text-primary, text-muted) are available as Tailwind utility classes in IntelliSense
- [ ] The ShadCN Button component's primary variant displays the espresso (#3A2D28) background colour
- [ ] Playfair Display, Inter, and JetBrains Mono fonts all load correctly with no visible layout shift in Chrome DevTools
- [ ] All canonical directories from Section 4 of 00_Project_Overview.md exist in the repository
- [ ] The @/ path alias resolves correctly in both the TypeScript compiler and the Next.js development server
- [ ] "pnpm prisma studio" opens without database connection errors
- [ ] The .env.example file is present and documents every required environment variable
- [ ] The pre-commit hook prevents commits when ESLint or Prettier checks fail

## Files Created / Modified

- All directories under src/ as defined in the canonical layout in 00_Project_Overview.md
- prisma/schema.prisma — initial generator and datasource configuration
- tailwind.config.ts — VelvetPOS colour tokens, font family extensions, and spacing overrides
- src/app/globals.css — CSS custom property declarations for all 12 design tokens
- src/app/layout.tsx — root layout with font variables and provider wrappers
- src/app/(store)/layout.tsx — store route group layout shell
- src/app/(superadmin)/layout.tsx — superadmin route group layout shell
- src/app/(auth)/layout.tsx — auth route group layout shell
- src/lib/fonts.ts — next/font configuration exporting CSS variable names
- src/components/shared/QueryProvider.tsx — TanStack Query client provider
- src/stores/cartStore.ts — Zustand cart store skeleton
- src/stores/offlineStore.ts — Zustand offline queue store skeleton
- src/stores/uiStore.ts — Zustand UI state store skeleton
- src/components/ui/ — ShadCN component files for Button, Card, Input, Select, Textarea, Table, Badge, Dialog, Sheet, Toast
- prisma/seed.ts — seed script scaffold
- .env.example — environment variable documentation template
- README.md — project setup and development guide
- package.json — updated with pnpm settings, prisma.seed script, and lint-staged configuration
- tsconfig.json — strict mode flags and @/ path alias
- next.config.ts — Next.js 15 configuration
- eslint.config.mjs — ESLint flat config with Next.js and TypeScript rules
- prettier.config.mjs — Prettier formatting configuration
- .husky/pre-commit — Husky pre-commit hook script
