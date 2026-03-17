# Task 05.03.10 — Run Final TypeScript and ESLint Audit

## Metadata

| Field | Value |
|---|---|
| Task ID | 05.03.10 |
| Task Name | Run Final TypeScript and ESLint Audit |
| SubPhase | 05.03 — Production Deployment and Polish |
| Complexity | Medium |
| Estimated Duration | 3–4 hours |
| Assignee Role | Lead Developer |
| Dependencies | All prior tasks complete — entire codebase written and integrated |
| Output Files | .eslintrc.json (updated), tsconfig.json (verified), no new source files |

## Objective

Perform a final comprehensive audit of the entire VelvetPOS TypeScript codebase for type errors and linting violations. The target state is zero TypeScript compiler errors and zero ESLint errors across the src/ directory. Document the resolution approach for the most common classes of issues encountered when integrating Prisma raw queries and dynamic API data, and confirm that pnpm run build produces a successful production build with no warnings escalated to errors.

## Instructions

**Step 1: Run the TypeScript Compiler in Check Mode**

From the project root, run pnpm tsc --noEmit. This instructs the TypeScript compiler to perform a full type-check of all files in the project without emitting any output files, essentially acting as a dry-run of the build's type phase. The --noEmit flag is essential — without it, tsc would overwrite compiled output and may conflict with Next.js's own build pipeline.

On first run, expect to encounter three common categories of issues: (a) implicit any types on variables that could not be inferred, particularly in Prisma.$queryRaw result handling; (b) possibly-undefined access chains where a nullable Prisma relation field is used without a null check; and (c) missing return types on async API route handler functions. Address each category as described in subsequent steps. The goal is to run pnpm tsc --noEmit and see the output "Found 0 errors." with no additional lines.

**Step 2: Resolve Any-Typed Prisma queryRaw Results**

Prisma's $queryRaw method returns Promise&lt;unknown[]&gt; rather than a typed array, because the query is a raw SQL string and Prisma cannot infer the result shape. If pnpm tsc --noEmit reports implicit any errors on queryRaw results or on variables that receive the output, apply the following pattern at the data layer boundary.

Define a Zod schema that matches the expected shape of the raw query result — for example, the health check query returns rows with a single unnamed column, so define z.array(z.object({ "?column?": z.number() })) or simply discard the result since it is used only for latency measurement. For any aggregate raw queries used in reports (for example, daily revenue totals), define a strict Zod schema with z.array(z.object({ ... })) matching the SQL column aliases in the query. After the queryRaw call, pass the result through the schema using schema.parse(rawResult) — this both validates at runtime and gives TypeScript the correct inferred type for subsequent code. Encapsulate this pattern in a small utility function parseQueryResult(schema, data) defined in src/lib/db/parse-query.ts.

**Step 3: Configure ESLint with Strict Rules**

Open or create .eslintrc.json at the project root. Confirm the configuration extends the following rule sets in order: "next/core-web-vitals", "plugin:@typescript-eslint/recommended", and "plugin:react-hooks/recommended". Under the rules key, declare the following rule severities:

@typescript-eslint/no-explicit-any set to "error" — any use of the any type keyword in source code triggers a build error. This enforces that all queryRaw and dynamic data receives a proper Zod-validated type. no-console set to "warn" — console.log calls anywhere in production code produce warnings, reminding developers to remove debug statements before committing. react-hooks/rules-of-hooks set to "error" — calling hooks conditionally or inside loops is a build-breaking error. react-hooks/exhaustive-deps set to "warn" — missing TanStack Query or useEffect dependency arrays produce warnings that must be reviewed before merge. @typescript-eslint/no-unused-vars set to "error" with the argsIgnorePattern option of "^_" — unused variables are errors except when prefixed with an underscore (the conventional "intentionally unused" marker). @typescript-eslint/consistent-type-imports set to "warn" — type-only imports should use the import type syntax.

**Step 4: Run ESLint Across the Entire Source Directory**

Run pnpm eslint src/ --ext .ts,.tsx from the project root. Review the output grouped by file. Common issues to resolve include:

console.log statements left in service functions during development — remove them or replace with a structured logger. Variables declared but never referenced in component files — remove or prefix with an underscore. Missing dependency arrays in useEffect or TanStack Query queryFn — add missing dependencies or add an ESLint disable comment with a documented justification for why the dependency should not be included (this is rare and requires a deliberate decision). Explicit any types remaining from Prisma interop — resolve using the Zod pattern from Step 2.

After resolving all items, re-run pnpm eslint src/ --ext .ts,.tsx and confirm the output shows no errors and only acceptable warnings (no-console warnings on legitimate logger calls that are intended to remain are acceptable as warnings since the rule is set to "warn").

**Step 5: Run the Production Build**

Run pnpm run build to perform a full Next.js production build. This step compiles all pages, runs the TypeScript type checker, applies ESLint rules configured via next.config.ts (Next.js runs ESLint as part of the build by default), and pre-renders any static pages. The expected output is a build manifest with all routes listed, page sizes reported, and the final line "✓ Compiled successfully." A build that succeeds with zero errors is the definitive sign-off criterion for this task.

If the build fails with a "Type error:" message, revisit pnpm tsc --noEmit output. If it fails with an "ESLint:" message, revisit pnpm eslint output. Resolve each issue at the source — avoid suppressing errors with @ts-ignore or eslint-disable-next-line comments unless there is a documented library incompatibility (for example, certain ShadCN component props that have incomplete type definitions in a specific package version).

**Step 6: Document the Clean State**

In the project README, under a section titled "Code Quality", document the commands that verify the codebase is in a clean state: run pnpm tsc --noEmit for type checking, run pnpm eslint src/ --ext .ts,.tsx for lint checking, and run pnpm run build for a full production build verification. Add these three commands to the CI/CD pipeline configuration (if GitHub Actions is set up) as required passing steps before a pull request can be merged to main.

## Expected Output

- .eslintrc.json — Updated with strict rules for no-explicit-any, no-console, react-hooks, no-unused-vars, and consistent-type-imports
- src/lib/db/parse-query.ts — Utility function for Zod-validated Prisma queryRaw result parsing
- No new source files — all other changes are removals, fixes, and type annotations on existing code

## Validation

- [ ] pnpm tsc --noEmit outputs "Found 0 errors." with no additional diagnostic lines
- [ ] pnpm eslint src/ --ext .ts,.tsx reports zero errors (warnings for no-console on intentional log calls are acceptable)
- [ ] pnpm run build completes successfully with "✓ Compiled successfully." output
- [ ] No @ts-ignore suppression comments exist in the codebase (search with grep)
- [ ] No explicit any types remain in src/ files visible to the TypeScript compiler
- [ ] All Prisma $queryRaw results in report and health-check files pass through a Zod schema before use
- [ ] The three quality-check commands are documented in the project README

## Notes

- Next.js has a configuration option in next.config.ts to fail the build on ESLint errors: set eslint.ignoreDuringBuilds to false (the default). Ensure this option is not accidentally set to true, which would silently suppress ESLint errors during Vercel deployments.
- If the ShadCN source files under src/components/ui/ contain type definitions that trip @typescript-eslint/no-explicit-any (ShadCN-generated files occasionally do), add the ui/ directory to the ESLint ignore list in .eslintignore rather than overriding the rule globally. The rule should remain active for all application code.
