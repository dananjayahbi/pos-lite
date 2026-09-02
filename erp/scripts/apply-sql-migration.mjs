// One-off helper: apply a raw migration.sql to the local PostgreSQL DB.
// prisma migrate fails with P1013 because DATABASE_URL in .env.local is quoted,
// so we strip the surrounding quotes and run the SQL directly.
//
// Usage: node scripts/apply-sql-migration.mjs <path/to/migration.sql>
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import pg from 'pg';

const __dirname = dirname(fileURLToPath(import.meta.url));
const erpRoot = resolve(__dirname, '..');
const migrationPath = process.argv[2];

if (!migrationPath) {
  console.error('Usage: node scripts/apply-sql-migration.mjs <path/to/migration.sql>');
  process.exit(1);
}

// Read DATABASE_URL from .env.local if present, otherwise fall back to .env
// (strip optional surrounding quotes).
import { existsSync } from 'node:fs';
const envFilePath = existsSync(resolve(erpRoot, '.env.local'))
  ? resolve(erpRoot, '.env.local')
  : resolve(erpRoot, '.env');
const envRaw = readFileSync(envFilePath, 'utf8');
const match = envRaw.match(/^DATABASE_URL="?([^"\n]+)"?$/m);
if (!match) {
  console.error(`DATABASE_URL not found in ${envFilePath}`);
  process.exit(1);
}
const databaseUrl = match[1];

const sql = readFileSync(resolve(erpRoot, migrationPath), 'utf8');

const client = new pg.Client({ connectionString: databaseUrl });
try {
  await client.connect();
  await client.query(sql);
  console.log(`Applied migration: ${migrationPath}`);
} catch (err) {
  console.error('Migration failed:', err.message);
  process.exitCode = 1;
} finally {
  await client.end();
}
