# Task 01.01.02 — Configure Prisma and PostgreSQL

## Metadata

| Field | Value |
|---|---|
| Sub-Phase | SubPhase 01.01 — Project Setup & Configuration |
| Phase | Phase 01 — The Foundation |
| Estimated Complexity | Medium |
| Dependencies | Task_01_01_01 |

## Objective

Install Prisma ORM and its client library, configure it to connect to the VelvetPOS PostgreSQL database, and verify connectivity via Prisma Studio — producing a schema.prisma with only the generator and datasource blocks and a recorded initial migration.

## Instructions

### Step 1: Install Prisma Dependencies

From the project root, run "pnpm add @prisma/client" to install the Prisma runtime client as a production dependency. Then run "pnpm add -D prisma" to install the Prisma CLI as a development dependency. The separation is intentional: @prisma/client is required at runtime when the application queries the database, while the prisma CLI is needed only during development and in CI/CD build pipelines. Mixing these into the wrong dependency category would either bloat the production bundle or break local developer tooling.

### Step 2: Initialise Prisma

Run "pnpm prisma init --datasource-provider postgresql" in the project root. This command creates two artifacts: a prisma/ directory containing a schema.prisma file, and a .env file in the root with a placeholder DATABASE_URL variable. Review the generated schema.prisma to confirm it contains a datasource block configured for the postgresql provider and a generator block configured to output the @prisma/client package. Do not add any model definitions at this stage — all data models are introduced in later sub-phases once the business domain is established.

### Step 3: Configure the Database Connection URL

Create a file named ".env.local" in the project root. This is distinct from the .env file that Prisma init created. Add the DATABASE_URL environment variable to .env.local using the connection string format required by Prisma for PostgreSQL: "postgresql://USERNAME:PASSWORD@HOST:PORT/DATABASE_NAME?schema=public". Replace each segment with the actual credentials for your managed PostgreSQL instance obtained in Task 01.01.01. Confirm that .env.local is listed in .gitignore to ensure secrets are never committed to source control. Prisma automatically reads from .env.local in a Next.js project environment because Next.js prioritises that file. Once .env.local is in place, delete the .env file that "prisma init" created, as keeping both files risks confusion over which one is authoritative.

### Step 4: Confirm .gitignore Coverage

Open .gitignore and confirm it lists .env, .env.local, and .env*.local to prevent accidental secret exposure. Also confirm that the prisma/migrations/ directory is NOT listed in .gitignore — migration SQL files must be committed to version control so that every environment (local, staging, production) can replay the exact same migration history. This is a critical distinction from the .env files, which are always gitignored.

### Step 5: Run the First Migration

With the database credentials configured, run "pnpm prisma migrate dev --name init_phase1_foundation". Because schema.prisma currently contains no data models, this migration will create only the _prisma_migrations tracking table in the database and record this initial migration entry. Prisma will also automatically run "pnpm prisma generate" at the end of the migration, generating the TypeScript type definitions for @prisma/client. Confirm that the prisma/migrations/ directory is created and contains one timestamped folder whose name ends with "init_phase1_foundation". The presence of this directory confirms successful database communication.

### Step 6: Open Prisma Studio

Run "pnpm prisma studio" to launch the Prisma web-based database browser on port 5555. Open http://localhost:5555 in a browser tab. Confirm that Prisma Studio loads without connection errors. Because no models are defined yet, the left sidebar will be empty — this is expected and correct at this stage. A successful empty studio view confirms that the DATABASE_URL is correctly configured and the database is reachable. Close Prisma Studio by stopping the process with Ctrl+C before proceeding.

### Step 7: Add the Prisma Generate Postinstall Script

Open package.json and add a "postinstall" entry to the "scripts" object with the value "prisma generate". This ensures that whenever a new contributor runs "pnpm install" on a fresh clone of the repository, the Prisma client TypeScript typings are automatically regenerated without requiring a manual step. Without this, a freshly cloned project would fail to compile until the developer discovers they need to run prisma generate manually.

## Expected Output

- The prisma/ directory exists and contains schema.prisma with only a datasource block (postgresql provider) and a generator block (@prisma/client output)
- The prisma/migrations/ directory contains a single timestamped migration folder named with the "init_phase1_foundation" suffix
- The @prisma/client package is installed and its generated types are present under node_modules/.prisma/client/
- .env.local contains a valid DATABASE_URL and is confirmed as gitignored
- The package.json postinstall script runs "prisma generate"
- Prisma Studio opens at localhost:5555 with a successful database connection and an empty model list

## Validation

- [ ] "pnpm prisma migrate dev" completes without database connection errors
- [ ] "pnpm prisma studio" opens at localhost:5555 with no error messages
- [ ] schema.prisma contains only datasource and generator blocks — no model definitions
- [ ] .env.local is listed in .gitignore and does not appear as a git-tracked file
- [ ] The postinstall script in package.json runs "prisma generate"
- [ ] The prisma/migrations/ directory is present and tracked by git

## Notes

The .env file created by "prisma init" is superseded by .env.local in a Next.js project. Always use .env.local for local development secrets and .env.example (created in Task 01.01.12) for documentation. In CI/CD environments, environment variables are injected via the hosting platform's secret management interface, and .env.local is never deployed or stored in the build context. Prisma's DATABASE_URL must include the ?schema=public query parameter for managed PostgreSQL services such as Supabase or Railway to route connections correctly.
