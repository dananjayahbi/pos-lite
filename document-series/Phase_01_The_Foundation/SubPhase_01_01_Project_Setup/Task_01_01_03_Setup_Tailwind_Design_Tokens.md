# Task 01.01.03 — Setup Tailwind Design Tokens

## Metadata

| Field | Value |
|---|---|
| Sub-Phase | SubPhase 01.01 — Project Setup & Configuration |
| Phase | Phase 01 — The Foundation |
| Estimated Complexity | Medium |
| Dependencies | Task_01_01_01 |

## Objective

Configure all twelve VelvetPOS design tokens — six brand colours, six semantic colours, custom typography font families, and spacing extensions — in tailwind.config.ts, and declare the corresponding CSS custom properties in the global stylesheet so that every token is available both as a raw CSS variable and as a Tailwind utility class.

## Instructions

### Step 1: Define CSS Custom Properties in the Global Stylesheet

Open src/app/globals.css. After the three Tailwind directives, add a CSS rule targeting the :root pseudo-class. Inside it, declare all twelve colour custom properties as hex values: --color-espresso set to #3A2D28, --color-terracotta set to #A48374, --color-sand set to #CBAD8D, --color-mist set to #D1C7BD, --color-linen set to #EBE3DB, --color-pearl set to #F1EDE6, --color-success set to #4CAF50, --color-warning set to #FF9800, --color-danger set to #F44336, --color-info set to #2196F3, --color-text-primary set to #1A1210, and --color-text-muted set to #6B5E58. Also declare three font custom property placeholders that will be populated with actual values by next/font in Task 01.01.08: --font-display, --font-body, and --font-mono, each set to empty strings for now. Following the :root block, add a global body rule setting background-color to var(--color-pearl) and color to var(--color-text-primary). This gives every page the pearl warm-off-white background by default.

### Step 2: Configure Colour Tokens in tailwind.config.ts

Open tailwind.config.ts. Inside the theme.extend.colors object, add each of the twelve colour tokens by name, with each value referencing the corresponding CSS custom property using Tailwind's CSS variable syntax. The standard syntax for a colour token that supports Tailwind's opacity modifier system is to use the CSS variable wrapped in the appropriate format for your Tailwind version. Use the token name without the "--color-" prefix as the key, so that espresso, terracotta, sand, mist, linen, pearl, success, warning, danger, info, text-primary, and text-muted all become valid Tailwind colour identifiers. With these entries in place, every colour token generates a full suite of utility classes: bg-espresso, text-espresso, border-espresso, ring-espresso, fill-espresso, and so on, across all twelve tokens.

### Step 3: Configure Font Family Extensions

Inside the theme.extend.fontFamily object in tailwind.config.ts, add three font family entries. The "display" entry should reference the --font-display CSS variable as its first value and include "Georgia" and the generic "serif" keyword as fallbacks — these fallbacks ensure readable typography even before the custom font loads. The "body" entry should reference --font-body with "system-ui" and "sans-serif" as fallbacks. The "mono" entry should reference --font-mono with "Menlo" and "monospace" as fallbacks. These entries make the utility classes font-display, font-body, and font-mono available for use in JSX classNames throughout the application.

### Step 4: Verify the Content Paths Configuration

Confirm that the content array in tailwind.config.ts covers all TypeScript and JSX/TSX files under the src/ directory. The recommended glob pattern is "./src/**/*.{js,ts,jsx,tsx,mdx}". If the Next.js CLI generated a different or narrower pattern, update it to match this one. Correct content configuration is essential for Tailwind's JIT (just-in-time) engine to scan every component and page file for class name usage and included every referenced utility in the final CSS bundle.

### Step 5: Add Border Radius and Spacing Extensions

Inside theme.extend in tailwind.config.ts, add a borderRadius extension with two named entries. The "card" entry should be set to "12px" — this is the standard border radius for all card surfaces in VelvetPOS. The "button" entry should be set to "8px" for button components. Using named radius tokens rather than raw pixel values means that if the design system's corner radius standard changes, it can be updated in one place and propagate everywhere. Add no additional spacing overrides at this stage; the default Tailwind spacing scale is sufficient for Phase 01.

### Step 6: Verify Token Availability via IntelliSense

Start the development server with "pnpm dev". Open any TypeScript component file and begin typing a className string. Confirm that VS Code's Tailwind CSS IntelliSense extension surfaces the espresso, terracotta, sand, mist, linen, and pearl tokens in its autocomplete dropdown with correct hex colour swatches. Verify that text-text-primary, bg-linen, and border-mist also appear. Remove any temporary test elements you added. Stop the development server once the verification is complete.

## Expected Output

- src/app/globals.css contains a :root block declaring all twelve --color-* CSS custom properties and three --font-* placeholder custom properties
- tailwind.config.ts extends colors with all twelve token names referencing their CSS variables
- tailwind.config.ts extends fontFamily with display, body, and mono entries referencing the three font CSS variables
- tailwind.config.ts extends borderRadius with card (12px) and button (8px) named values
- The application body has a pearl (#F1EDE6) background colour by default
- All twelve colour utility classes are available and previewed correctly in Tailwind IntelliSense

## Validation

- [ ] All twelve colour tokens appear in Tailwind CSS IntelliSense with correct colour swatches
- [ ] The application background in the browser is pearl (#F1EDE6) as confirmed in Chrome DevTools
- [ ] "pnpm tsc --noEmit" passes with no errors after tailwind.config.ts modifications
- [ ] The utility classes bg-espresso, text-terracotta, border-sand, and bg-linen are all valid
- [ ] The three font family utilities font-display, font-body, and font-mono are defined and visible in IntelliSense

## Notes

Tailwind CSS 4 introduces an alternative CSS-first configuration approach where tokens can be defined inside a @theme block directly in globals.css rather than in tailwind.config.ts. If the installed version of Tailwind CSS supports and recommends this approach, the @theme block in globals.css is equally acceptable as long as all twelve tokens produce valid Tailwind utility classes. Verify the installed Tailwind CSS version and consult its release documentation to determine the preferred configuration strategy. Either approach is valid as an outcome for this task.
