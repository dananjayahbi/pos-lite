# Task 01.01.11 — Configure Prisma Seed Script

## Metadata

| Field | Value |
|---|---|
| Sub-Phase | SubPhase 01.01 — Project Setup & Configuration |
| Phase | Phase 01 — The Foundation |
| Estimated Complexity | Low |
| Dependencies | Task_01_01_02 |

## Objective

Create the prisma/seed.ts scaffold, configure package.json with the prisma.seed entry, install a TypeScript script runner, and verify that "pnpm prisma db seed" executes successfully and prints a database connectivity confirmation message.

## Instructions

### Step 1: Install the TypeScript Script Runner

The Prisma seed script is a TypeScript file that Prisma executes directly via Node.js. Because Node.js cannot run TypeScript natively, a TypeScript runtime is necessary. Install tsx as a development dependency by running "pnpm add -D tsx". tsx is built on esbuild and provides extremely fast TypeScript execution without a full standalone compilation step. It correctly handles ESM module syntax, path aliases configured in tsconfig.json, and the module patterns used by Next.js projects. Do not install ts-node as an alternative — tsx is the modern recommended toolchain for Prisma seed scripts and avoids the configuration complexity that ts-node requires in ESM-mode Next.js projects.

### Step 2: Create the Seed File

Create the file prisma/seed.ts in the root-level prisma/ directory. This location follows the Prisma convention for database-related scripts and places it alongside schema.prisma and the migrations/ directory. Do not create this file under src/ — seed scripts are database tooling, not application source code.

The seed file should be structured as follows. Import PrismaClient from "@prisma/client" using a named import. Instantiate PrismaClient as a constant named "prisma" by calling the PrismaClient constructor with no arguments. Define an asynchronous function named "main" that performs three steps in sequence: call prisma.$connect() and await its resolution to establish the database connection explicitly, call console.log with the message "Prisma seed script connected to the database successfully. No data seeded at this stage — Phase 01 placeholder.", and then call prisma.$disconnect() and await its resolution to close the connection cleanly. After the main function definition, invoke main() and chain two handlers: a .catch() handler that logs the error object to the console using console.error and then calls process.exit(1) to terminate Node.js with a failing exit code, and a .finally() handler that calls prisma.$disconnect() to guarantee that the database connection is always closed even if the main function throws an error before reaching its own disconnect call.

### Step 3: Configure the Seed Script Entry in package.json

Open package.json. Add or update a top-level "prisma" key (this key is separate from the "scripts" key). Inside the "prisma" object, add a "seed" property with the value "tsx prisma/seed.ts". This configuration entry tells the Prisma CLI exactly which command to run when "pnpm prisma db seed" is invoked. The prisma key at the package.json top level is a Prisma-specific convention that is documented in the Prisma ORM reference and should not be confused with the scripts block.

### Step 4: Add prisma/**/* to the TypeScript Include Array

Open tsconfig.json and locate the top-level "include" array. Confirm that "prisma/**/*" is listed as an entry — it was added in Task 01.01.07 during the TypeScript configuration step. If it was not added then, add it now. This inclusion ensures the TypeScript compiler type-checks the seed file as part of the project's unified compilation context, which means any type errors introduced in seed.ts will surface during "pnpm tsc --noEmit" just as they would for application source files.

### Step 5: Verify @prisma/client Generation

Before running the seed script, confirm that the Prisma client is up to date by running "pnpm prisma generate". This regenerates the TypeScript type definitions from the current schema.prisma. With no models defined at this stage, the generated client will be minimal, but the $connect and $disconnect lifecycle methods that the seed script calls will be present and correctly typed. If this step is skipped and the generated client is stale or missing, the seed file will fail to compile or fail to find the necessary methods.

### Step 6: Run the Seed Script

Run "pnpm prisma db seed" in the terminal. Prisma reads the "prisma.seed" entry from package.json and executes the configured command. Watch the terminal output carefully. The first line should be the Prisma CLI's own confirmation that it is running the seed command. The second line should be the console.log message from the seed function: "Prisma seed script connected to the database successfully. No data seeded at this stage — Phase 01 placeholder." The command should then exit with code 0 (success). If the command fails with a database connection error, verify that the DATABASE_URL in .env.local is correct and the PostgreSQL server is accessible.

### Step 7: Verify TypeScript Compilation of the Seed File

Run "pnpm tsc --noEmit" and confirm the seed file passes type checking without errors. The main concern is that the PrismaClient constructor is called correctly and that the $connect and $disconnect methods are invoked with the correct signatures. Because no models are defined yet, the prisma instance will have very few typed methods beyond the internal lifecycle methods — this is expected and correct.

## Expected Output

- prisma/seed.ts exists and contains an async main function that connects, logs, and disconnects using PrismaClient
- package.json contains a "prisma": { "seed": "tsx prisma/seed.ts" } entry at the top level
- tsx is listed as a devDependency in package.json
- "pnpm prisma db seed" executes successfully and prints the connection confirmation log message with exit code 0
- "pnpm tsc --noEmit" passes with prisma/seed.ts included in the compilation

## Validation

- [ ] "pnpm prisma db seed" completes with exit code 0
- [ ] The terminal output includes the connection confirmation message
- [ ] prisma/seed.ts is included in TypeScript compilation and produces no type errors
- [ ] package.json has the prisma.seed configuration entry
- [ ] tsx is listed as a devDependency

## Notes

The seed script scaffold created in this task is intentionally minimal — it is a structural placeholder rather than a functional seeder. As data models are added in later sub-phases, the seed file is extended by adding new asynchronous helper functions that are then called from within the main orchestrator function. This pattern keeps the main function readable and allows individual seed steps (for example, seedProductCategories or seedDefaultStore) to be developed, tested, and enabled independently. Seed scripts must always be written to be idempotent — re-running them should not create duplicate records. Use "upsert" rather than "create" for all seed operations once actual data is added.
