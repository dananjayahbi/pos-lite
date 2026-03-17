# Task 01.01.06 — Create Directory Structure

## Metadata

| Field | Value |
|---|---|
| Sub-Phase | SubPhase 01.01 — Project Setup & Configuration |
| Phase | Phase 01 — The Foundation |
| Estimated Complexity | Low |
| Dependencies | Task_01_01_01 |

## Objective

Create the complete canonical directory structure for VelvetPOS under src/ and public/ as defined in Section 4 of 00_Project_Overview.md, with .gitkeep placeholder files ensuring all empty directories are tracked by Git.

## Instructions

### Step 1: Review the Canonical Directory Layout

Before creating any directories, open document-series/00_Project_Overview.md and read Section 4 in its entirety. This section defines the authoritative directory tree for VelvetPOS — every directory listed there must be created in this task. Use this document as the sole source of truth for the project structure. Do not create directories not listed in Section 4, and do not omit any that are listed. Deviating from the canonical layout will cause confusion when later tasks reference specific paths.

### Step 2: Create Application Route Directories

Navigate to src/app/ and create the three route group directories: (auth)/, (store)/, and (superadmin)/. Inside (auth)/, create the subdirectories: login/, two-factor/, and reset-password/. Inside (store)/, create: dashboard/, pos/, inventory/, inventory/[productId]/ (note the square brackets denoting a dynamic segment), reports/, customers/, customers/[customerId]/, and settings/. Inside (superadmin)/, create: dashboard/, stores/, users/, billing/, and settings/. Inside src/app/api/, create nested directories for: auth/, trpc/, webhooks/payhere/, and webhooks/whatsapp/. These directories represent the full routing surface area for the VelvetPOS application — pages and API routes created in later sub-phases will land directly inside these directories.

### Step 3: Create Component Subdirectories

Navigate to src/components/ and create the following subdirectory hierarchy. The ui/ subdirectory was partially populated by ShadCN in Task 01.01.04 and should already exist — verify it is present but do not recreate it. Create pos/ for POS-specific components such as the product search grid, cart line items panel, and payment workflow modal. Create inventory/ for inventory management components such as product creation forms and stock level tables. Create reports/ for chart and data visualisation components used in the reporting sub-phase. Create shared/ for cross-cutting components that are used across multiple feature areas, such as the navigation sidebar, breadcrumb trail, global data table, skeleton loading states, and confirmation dialogs. Inside shared/, create a layout/ subdirectory specifically for the AppSidebar and AppHeader structural components. Create superadmin/ for super admin-specific components such as the store management table and platform metrics dashboard.

### Step 4: Create Library and Utility Subdirectories

Navigate to src/lib/ and create the following subdirectorys: validators/ for Zod schema files, with one file per business domain (for example productSchema.ts, customerSchema.ts, transactionSchema.ts); services/ for server-side database query functions and business logic helpers; auth/ for NextAuth.js configuration modules and helper utilities; and utils/ for general-purpose utility functions. The src/lib/ directory itself and a utils.ts file were created by the ShadCN CLI in Task 01.01.04 — preserve the existing utils.ts file when creating the subdirectories, as ShadCN components depend on its exports.

### Step 5: Create Hooks, Stores, Types, and Constants Directories

Create src/hooks/ to hold all custom React hooks. Create src/stores/ to hold the Zustand state management store files — the skeleton files for cartStore.ts, offlineStore.ts, and uiStore.ts will be added here in Task 01.01.10. Create src/types/ for TypeScript type definition files and index barrel exports that re-export types from multiple modules. Create src/constants/ for application-wide constant values such as pagination defaults, status enumerations, currency codes, supported locales, and configuration keys that are referenced across multiple modules.

### Step 6: Create Public Asset Directories

Navigate to the public/ directory in the project root and create the following subdirectories: fonts/ for the self-hosted font files that will be downloaded and placed in Task 01.01.08, icons/ for SVG icon files and favicon variants of various sizes, and images/ for product placeholder images, brand logos, and other static image assets used across the application.

### Step 7: Add .gitkeep Placeholders to All Empty Directories

Git does not track empty directories — if an empty directory is committed, collaborators who clone the repository will not receive it. For every directory created in Steps 2 through 6 that does not already contain real files, create an empty file named ".gitkeep" inside it. This includes all route directories in src/app/(auth)/, (store)/, and (superadmin)/ that do not yet have layout.tsx or page.tsx files, all component subdirectories that have no component files yet, all lib/ subdirectories that have no utility files yet, src/hooks/, src/stores/, src/types/, src/constants/, public/fonts/, public/icons/, and public/images/. Directories that should NOT receive .gitkeep because they already contain files include: src/app/ (has layout.tsx and page.tsx), src/components/ui/ (has ShadCN component files), and src/lib/ (has utils.ts from ShadCN).

### Step 8: Verify the Directory Tree

Run the command "find src -type d | sort" in the terminal to list all directories under src/ in alphabetical order. Compare this output line by line against the canonical layout in Section 4 of 00_Project_Overview.md. Repeat with "find public -type d | sort" for the public/ asset directories. If any directory is missing, create it and add a .gitkeep. If any extra directory exists that is not in the canonical layout, remove it. Only proceed when the directory trees match exactly.

## Expected Output

- All canonical directories from the 00_Project_Overview.md Section 4 canonical layout exist under src/ and public/
- Every empty directory contains a .gitkeep file so that it is committed to source control
- No extra directories outside the canonical layout have been created
- "git status" shows all new .gitkeep files as new untracked additions awaiting staging

## Validation

- [ ] "find src -type d | sort" output matches the canonical structure defined in 00_Project_Overview.md
- [ ] Every empty directory contains a .gitkeep file
- [ ] No directories outside the canonical layout exist in the project
- [ ] src/components/ui/ contains the ShadCN component files from Task 01.01.04 and no .gitkeep
- [ ] src/lib/utils.ts is preserved and not overwritten

## Notes

The .gitkeep file convention is universally understood by experienced developers and is semantically clearer than using a .gitignore placeholder. When a directory receives its first substantive file from a later task, the .gitkeep in that directory should be deleted in the same commit that adds the real file. This keeps the repository clean and signals to reviewers that the directory now has active content. The canonical directory layout in 00_Project_Overview.md is the single authoritative source — any proposed changes to the project structure must be reflected there first before being implemented here.
