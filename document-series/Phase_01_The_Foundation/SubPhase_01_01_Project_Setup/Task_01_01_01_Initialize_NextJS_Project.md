# Task 01.01.01 — Initialize Next.js Project

## Metadata

| Field | Value |
|---|---|
| Sub-Phase | SubPhase 01.01 — Project Setup & Configuration |
| Phase | Phase 01 — The Foundation |
| Estimated Complexity | Low |
| Dependencies | None |

## Objective

Bootstrap the VelvetPOS repository as a new Next.js 15+ application with TypeScript, the App Router, and pnpm as the package manager, producing a clean project skeleton ready for framework-layer configuration.

## Instructions

### Step 1: Verify Prerequisites

Before creating the project, confirm that the development environment has all required tools installed. Verify that Node.js version 20 or later is active by checking the version output in the terminal. Confirm that pnpm version 9 or later is installed — if it is not present, install it globally via npm by running "npm install -g pnpm". Confirm that a PostgreSQL server (either local or cloud-managed) is accessible and that credentials are at hand, as they will be needed in Task 01.01.02. Having these ready now avoids interruption later in the setup flow.

### Step 2: Create the Next.js Application

Navigate in your terminal to the parent directory where the VelvetPOS repository should live. Run the Next.js project initialiser by executing "pnpm create next-app@latest velvet-pos". The interactive CLI will present a series of prompts; answer each one as follows: accept TypeScript (yes), accept ESLint (yes), accept Tailwind CSS (yes), accept the src/ directory convention (yes), accept the App Router (yes), decline the Turbopack option for now (no — Turbopack will be evaluated later once stability in the project context is confirmed), and set the import alias to "@/*" mapping to "./src/*". Review each prompt answer before pressing Enter to avoid misconfigurations that would require recreating the project.

### Step 3: Open the Project and Verify the Default Structure

Change directory into the newly created "velvet-pos" folder. Open the folder in VS Code. Confirm the following files and directories were scaffolded by the CLI: src/app/layout.tsx, src/app/page.tsx, src/app/globals.css, public/, tailwind.config.ts, tsconfig.json, next.config.ts, package.json, and eslint.config.mjs. If any of these are missing, the CLI options may have been answered incorrectly and the project should be recreated fresh. Do not attempt to patch a partially scaffolded project — a clean scaffold is essential for a predictable foundation.

### Step 4: Configure pnpm as the Enforced Package Manager

Open package.json and add a "packageManager" field set to the exact pnpm version string currently installed on your system, for example "pnpm@9.x.x". This field is read by Corepack and Node.js tooling to enforce consistent package manager usage across all contributors. Also create a file named ".npmrc" in the project root and add the line "engine-strict=true" to it. This ensures that contributors using the wrong Node.js or pnpm version receive an immediate warning rather than a silent failure that could manifest as confusing runtime errors.

### Step 5: Install Dependencies with pnpm

Run "pnpm install" in the project root. This reads the package.json created by the Next.js CLI and installs all dependencies using pnpm, generating a pnpm-lock.yaml file. Confirm that node_modules/ is populated and pnpm-lock.yaml is present in the project root. If a package-lock.json or yarn.lock file was accidentally created (by running npm or yarn instead of pnpm at any point), delete it immediately and rerun "pnpm install" to ensure the lockfile is authoritative, consistent, and managed exclusively by pnpm throughout the project lifecycle.

### Step 6: Start the Development Server

Run "pnpm dev" to start the Next.js development server. Open a browser and navigate to http://localhost:3000. Confirm the default Next.js welcome page loads correctly and the browser title reads "Create Next App" or similar. Observe the terminal output to ensure there are no compilation errors or TypeScript warnings. Stop the server with Ctrl+C once the successful load is confirmed — leave no unnecessary processes running.

### Step 7: Remove Default Boilerplate Content

Open src/app/page.tsx and replace the entire contents with a minimal React functional component that renders a single heading element with the text "VelvetPOS — Development In Progress". This removes the default Next.js marketing content and establishes the file as a clean slate for future development. Open src/app/globals.css and remove all default Tailwind @layer base overrides and custom CSS that the Next.js CLI injected into the file — retain only the three Tailwind directives (@tailwind base, @tailwind components, @tailwind utilities). These directives represent the minimum required content at this stage; the full design token variable declarations will be added in Task 01.01.03.

## Expected Output

At the end of this task, the repository should contain:

- A fully scaffolded Next.js 15+ project using TypeScript and the App Router under the src/ directory
- A valid pnpm-lock.yaml file with all dependencies resolved and no other lock files present
- An .npmrc file with engine-strict mode enabled
- A package.json with the packageManager field referencing the correct pnpm version
- A clean src/app/page.tsx containing only the minimal VelvetPOS development placeholder heading
- A clean src/app/globals.css containing only the standard three Tailwind CSS directives
- The development server starts cleanly and serves the placeholder page at http://localhost:3000

## Validation

- [ ] "pnpm dev" starts without errors and the page at localhost:3000 loads
- [ ] pnpm-lock.yaml is present and no other lock files (package-lock.json, yarn.lock) exist
- [ ] The "packageManager" field in package.json references pnpm with a version string
- [ ] The @/* import alias is configured in tsconfig.json pointing to ./src/*
- [ ] src/app/page.tsx contains only the minimal VelvetPOS placeholder content
- [ ] src/app/globals.css contains only the three Tailwind directives with no injected overrides

## Notes

The Next.js CLI may scaffold slightly different boilerplate across minor releases. If the CLI-generated globals.css contains unexpected CSS layers or variable declarations beyond the Tailwind directives, remove all of it — the VelvetPOS design token system defined in Task 01.01.03 will replace those defaults entirely. Do not customise tailwind.config.ts during this task; that is strictly the responsibility of Task 01.01.03. Keeping each task's scope clean is important for traceability when debugging configuration issues later.
