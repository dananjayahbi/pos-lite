# Task 01.01.04 — Install ShadCN and Theme

## Metadata

| Field | Value |
|---|---|
| Sub-Phase | SubPhase 01.01 — Project Setup & Configuration |
| Phase | Phase 01 — The Foundation |
| Estimated Complexity | Medium |
| Dependencies | Task_01_01_03 |

## Objective

Install ShadCN/UI using its CLI initialiser and re-skin all core UI components to use VelvetPOS design tokens exclusively, ensuring no generic grey scale colours remain in any ShadCN component file.

## Instructions

### Step 1: Run the ShadCN CLI Initialiser

From the project root, run "pnpm dlx shadcn@latest init". The CLI will prompt for configuration options. Select "New York" as the style variant — this style produces components with a slightly more refined, compact, and professional aesthetic compared to the Default style, which suits VelvetPOS's clothing retail positioning. When asked for the base colour, select "neutral" as a starting point — it will be fully overridden by VelvetPOS tokens in the next step. Accept CSS variables (yes). When asked for the global CSS file path, enter "src/app/globals.css". When asked for the tailwind config path, enter "tailwind.config.ts". Confirm the components alias as "@/components" and the utils alias as "@/lib/utils". Allow the CLI to complete its initialisation and install its dependencies.

### Step 2: Replace ShadCN's Default CSS Variables with VelvetPOS Tokens

The ShadCN CLI injects a large set of CSS custom property declarations into globals.css covering --background, --foreground, --primary, and a complete design system palette. Open globals.css and locate the :root block added by ShadCN. Replace the ShadCN-generated CSS variable values with mappings to VelvetPOS tokens as follows: set --background to var(--color-pearl), set --foreground to var(--color-text-primary), set --primary to var(--color-espresso), set --primary-foreground to #FFFFFF, set --secondary to var(--color-linen), set --secondary-foreground to var(--color-text-primary), set --muted to var(--color-linen), set --muted-foreground to var(--color-text-muted), set --accent to var(--color-terracotta), set --accent-foreground to #FFFFFF, set --destructive to var(--color-danger), set --border to var(--color-mist), set --input to var(--color-mist), set --ring to var(--color-sand), and set --radius to 8px. Remove the .dark theme block entirely — VelvetPOS does not implement a dark mode in its initial versions.

### Step 3: Add and Audit the Button Component

Run "pnpm dlx shadcn@latest add button" to scaffold button.tsx into src/components/ui/. Open the generated file and review its variant configuration. The primary (default) variant should produce a button with the --primary CSS variable as its background, which now maps to espresso (#3A2D28) via the remapping in Step 2. Verify the "secondary" variant uses the --secondary background (linen) and a --border coloured outline (mist). Verify the "ghost" variant shows no background at rest but applies a terracotta-coloured text on hover by referencing the --accent variable. The "destructive" variant should resolve to the danger token via --destructive. If any variant references Tailwind grey scale classes directly (zinc, slate, gray, stone), replace them with the equivalent VelvetPOS token reference.

### Step 4: Add and Audit Card and Form Input Components

Run "pnpm dlx shadcn@latest add card input select textarea" to scaffold these component groups. Open each generated file. The Card component's outer container should have its background set to --background (pearl) and its border to --border (mist). Open input.tsx and confirm the input field background is --background (pearl) or --muted (linen), the border is --input (mist), and the focus ring uses --ring (sand). The Select and Textarea components should mirror the Input styling for a consistent form element appearance throughout the application.

### Step 5: Add and Audit Table, Badge, Dialog, Sheet, and Toast Components

Run "pnpm dlx shadcn@latest add table badge dialog sheet sonner" to scaffold the remaining core components. For the Table component, the header row (thead) background should use pearl and the alternating data rows should cycle between pearl and linen for a subtle striped appearance. For the Badge component, audit whether it includes variants beyond the default — if not, manually add variant entries for "success", "warning", and "info" that apply the corresponding semantic colour tokens as their backgrounds. The default badge should use espresso as its background. For Dialog and Sheet, the content panels should use linen backgrounds. The Sonner toast component should have its success, error, and info variants' background and border colours derived from the VelvetPOS semantic tokens.

### Step 6: Audit All Components for Remaining Grey Scale Usage

Perform a full-text search in VS Code across the entire src/components/ui/ directory for any of the following class prefixes: "gray-", "zinc-", "slate-", "stone-", "neutral-". If any occurrences are found, replace each one with the semantically appropriate VelvetPOS token. As a reference: neutral or muted greys typically map to text-muted or mist, background greys map to linen or pearl, and dark foreground greys map to text-primary or espresso. No component file should contain any grey scale Tailwind class after this audit.

### Step 7: Visual Verification in the Browser

Run "pnpm dev" and temporarily add Button, Card, and Badge components to the placeholder page in src/app/page.tsx. Render the primary button, secondary button, ghost button, and destructive button. Render a Card. Render badges with the success, warning, and info variants. Use Chrome DevTools to inspect the computed CSS colour values and confirm they match the expected VelvetPOS hex values. Remove the temporary test elements from page.tsx after verification and stop the development server.

## Expected Output

- src/components/ui/ contains button.tsx, card.tsx, input.tsx, select.tsx, textarea.tsx, table.tsx, badge.tsx, dialog.tsx, sheet.tsx, and sonner.tsx
- The ShadCN CSS variables in globals.css are fully re-mapped to VelvetPOS tokens with no ShadCN defaults remaining
- No component file in src/components/ui/ contains any grey scale Tailwind class (gray, zinc, slate, stone, neutral)
- The Button primary variant renders with espresso (#3A2D28) background confirmed in Chrome DevTools
- The Badge component has success, warning, destructive, and info variants

## Validation

- [ ] "pnpm dev" starts without errors after ShadCN installation and theming
- [ ] The Button primary variant shows the espresso background colour in the browser inspector
- [ ] No grey scale Tailwind classes exist anywhere in src/components/ui/
- [ ] The Badge component has at minimum four semantic variants: success, warning, destructive, and info
- [ ] "pnpm tsc --noEmit" passes with zero errors

## Notes

ShadCN ships components as editable source files that live directly inside your project — they are not an npm dependency that receives updates automatically. This means you own every component file and are responsible for keeping them consistent with VelvetPOS tokens. For any future ShadCN component additions, run the grey scale audit described in Step 6 as an immediate follow-up. The shadcn add command accepts multiple component names in a single invocation, which reduces the number of CLI interactions needed during setup.
