# Task 01.01.08 — Setup Fonts and Assets

## Metadata

| Field | Value |
|---|---|
| Sub-Phase | SubPhase 01.01 — Project Setup & Configuration |
| Phase | Phase 01 — The Foundation |
| Estimated Complexity | Low |
| Dependencies | Task_01_01_03 |

## Objective

Download and self-host the three VelvetPOS typography fonts, configure them via the next/font/local module with CSS variable exports, and apply the font variables to the root layout's html element and the Tailwind font family configuration.

## Instructions

### Step 1: Download Font Files

Navigate to fonts.google.com and download the following font families and weights. For Playfair Display, download the Bold (700) weight. For Inter, download the Regular (400), SemiBold (600), and Bold (700) weights. For JetBrains Mono, download the Regular (400) weight. For each font, obtain files in the WOFF2 format at minimum — WOFF2 provides superior compression compared to WOFF or TTF, resulting in faster font loading. If WOFF fallback files for older browser compatibility are desired, download WOFF versions as well. A convenient method for downloading pre-converted WOFF2 files is to use the google-webfonts-helper web tool, which allows you to select a font family, choose specific weights and subsets (select "latin" for VelvetPOS), and download a ready-to-use package of WOFF2 and WOFF files.

### Step 2: Place Font Files in public/fonts/

Move all downloaded font files into the public/fonts/ directory created in Task 01.01.06. Remove the .gitkeep placeholder from public/fonts/ since the directory now has real content. Rename each file using a consistent lowercase kebab-case convention: playfair-display-700.woff2, inter-400.woff2, inter-600.woff2, inter-700.woff2, and jetbrains-mono-400.woff2. If WOFF fallback files were downloaded, name them with the same convention but with a .woff extension. Consistent naming makes font references in code easy to read and audit.

### Step 3: Create the Fonts Configuration File

Create a new file at src/lib/fonts.ts. This file centralises all next/font configuration for VelvetPOS and is the single source of truth for font loading. Import the localFont function from the "next/font/local" module — this is the correct next/font sub-module for self-hosted font files. Do not use "next/font/google", which fetches fonts from Google's infrastructure at build time, because VelvetPOS self-hosts its fonts for full offline capability and to remove build-time external network dependencies.

In the file, create three font configuration objects by calling localFont three times. For the display font representing Playfair Display, configure the src array to reference the single WOFF2 file at "/public/fonts/playfair-display-700.woff2" (using the path relative to the project root as next/font/local expects), set the weight to "700", set the style to "normal", set the display strategy to "swap" for graceful fallback rendering, and set the variable option to "--font-display". For the body font representing Inter, configure the src array to include three entries: one for each of the 400, 600, and 700 weight files, each specifying its path and weight value explicitly. Set the variable to "--font-body" and display to "swap". For the mono font representing JetBrains Mono, configure the src to the single WOFF2 file and set the variable to "--font-mono". Export the three configurations as named exports: displayFont, bodyFont, and monoFont respectively.

### Step 4: Apply Font Variables to the Root Layout

Open src/app/layout.tsx. Import the three font configurations from "@/lib/fonts". The next/font module returns configuration objects with a "variable" property that contains the CSS class name responsible for injecting the corresponding CSS custom property (--font-display, --font-body, --font-mono) into the document tree. Apply all three variable class names to the html element's className attribute by combining them as a space-separated string using template literals or array joining. This step makes the font CSS variables available globally to every component in the entire application, since they are applied at the topmost element of the HTML document.

### Step 5: Confirm Tailwind Font Family References

Open tailwind.config.ts and verify that the fontFamily extensions added in Task 01.01.03 reference exactly the CSS variable names "--font-display", "--font-body", and "--font-mono". These names must match precisely the variable option values set in the next/font configuration in Step 3. If there is any mismatch — for example, if Task 01.01.03 used "--font-heading" but Step 3 uses "--font-display" — correct the mismatch by aligning both to use the canonical names defined in Step 3. No other changes to tailwind.config.ts should be needed.

### Step 6: Handle the Icons Directory

Navigate to public/icons/ and confirm the .gitkeep placeholder is present. This directory will hold SVG icon files and favicon image variants in later phases but remains empty at this task's stage. Do not remove the .gitkeep yet — it will be removed when the first icon file is added.

### Step 7: Verify Font Loading in the Browser

Run "pnpm dev" and open http://localhost:3000 in Chrome. Open Chrome DevTools and navigate to the Network tab. Filter requests by the "Font" category. Reload the page and observe the font requests. Confirm that all font requests are served from the local path /fonts/ (for example /fonts/inter-400.woff2) and that none are fetched from an external CDN or from fonts.googleapis.com. Check the status code for each font request — expect 200 for all. Confirm that no "Failed to load resource" errors appear in the Console tab. Open the Performance tab and run a Lighthouse audit to check for Cumulative Layout Shift — next/font's built-in size-adjust and font-display:swap strategy should yield a CLS score of 0 related to font loading.

## Expected Output

- public/fonts/ contains at minimum five WOFF2 files: playfair-display-700.woff2, inter-400.woff2, inter-600.woff2, inter-700.woff2, and jetbrains-mono-400.woff2
- src/lib/fonts.ts exports three next/font/local configurations: displayFont, bodyFont, and monoFont, each with the correct variable option names
- src/app/layout.tsx applies all three font variable classNames to the html element
- Chrome DevTools confirms fonts are served from the local /fonts/ path with no external CDN requests
- No layout shift caused by font loading is observed in Lighthouse

## Validation

- [ ] public/fonts/ contains at minimum five WOFF2 font files with the canonical naming convention
- [ ] src/lib/fonts.ts exports displayFont, bodyFont, and monoFont with correct variable names
- [ ] The html element in the root layout carries all three font variable CSS classes
- [ ] Chrome DevTools Network panel shows fonts loaded from /fonts/ locally with HTTP 200
- [ ] No font-related CLS is observed in Lighthouse
- [ ] "pnpm tsc --noEmit" passes after the fonts.ts file is created

## Notes

Next.js's next/font module automatically generates the @font-face CSS declarations, handles preload link tags, and injects the CSS class that activates the custom property. You should not write manual @font-face rules in globals.css — doing so would create a duplicate declaration that conflicts with next/font's generated styles. In production deployments, the font files in public/fonts/ are served as static assets by the CDN layer in front of your deployment platform (such as Vercel's Edge Network), so font loading performance in production is typically even better than in local development.
