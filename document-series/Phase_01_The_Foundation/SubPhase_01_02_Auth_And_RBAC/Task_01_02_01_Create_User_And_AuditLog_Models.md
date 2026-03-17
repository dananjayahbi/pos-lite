# Task 01.02.01 — Create User And AuditLog Models

## Metadata

- **Sub-Phase:** 01.02 — Authentication, RBAC & Session Management
- **Phase:** 01 — The Foundation
- **Estimated Complexity:** Medium
- **Dependencies:** SubPhase 01.01 must be complete; Prisma configured and connected to PostgreSQL; at least one prior successful migration run

---

## Objective

Add the User, Session, VerificationToken, and AuditLog models to prisma/schema.prisma, then generate and apply a named migration that creates all corresponding database tables with the correct columns, indexes, constraints, and foreign key relationships.

---

## Instructions

### Step 1: Review the Existing Schema File

Open prisma/schema.prisma and review its current state. Confirm that the datasource block points to the PostgreSQL connection URL via the DATABASE_URL environment variable, and that the generator block references prisma-client-js. Note any models already present so you do not accidentally duplicate them.

### Step 2: Define the UserRole Enum

Below the generator and datasource blocks, declare a UserRole enum. The enum must contain exactly five members: SUPER_ADMIN, OWNER, MANAGER, CASHIER, and STOCK_CLERK. This enum is referenced by the User model and stored in the database as a native PostgreSQL enum type.

### Step 3: Add the User Model

Define the User model with the following fields in order. The id field should be a String acting as the primary key, defaulting to a cuid() generated value, representing a UUID-compatible identifier. The tenantId field should be a nullable String — it will be null for Super Admin accounts and will later receive a foreign key relation to the Tenant model in SubPhase 01.03. The email field must be a unique non-nullable String. The passwordHash field must be a non-nullable String that stores the bcrypt-hashed credential. The pin field must be a nullable String that stores the bcrypt-hashed 4-digit PIN; it is null until the user explicitly sets up a PIN. The role field must use the UserRole enum with no default value so the role is always explicitly set on creation. The permissions field must be a Json type with a default value of an empty array literal, allowing per-user permission overrides on top of the role defaults. The isActive field must be a Boolean defaulting to true; inactive users cannot authenticate. The sessionVersion field must be an Int defaulting to 1; this integer is incremented to invalidate all active sessions for the user. The lastLoginAt field must be a nullable DateTime updated on each successful login. The createdAt field must be a DateTime defaulting to now(). The updatedAt field must be a DateTime using the @updatedAt attribute so Prisma automatically maintains it. The deletedAt field must be a nullable DateTime used for soft deletion — a non-null value means the user is treated as deleted and must not be able to authenticate.

Add a database-level index on email and an index on tenantId to support efficient per-tenant user lookups. Map the model to the database table name "users" using the @@map attribute.

### Step 4: Add the Session Model

The Session model is required by the NextAuth.js Prisma adapter. Define it with the following fields: id as a String primary key defaulting to cuid(), sessionToken as a unique non-nullable String, userId as a non-nullable String (foreign key referencing User.id with cascade delete), and expires as a non-nullable DateTime. Add a relation field on User pointing back to sessions. Map this model to the table name "sessions".

### Step 5: Add the VerificationToken Model

The VerificationToken model is also required by the NextAuth.js Prisma adapter for email verification and password reset tokens. Define it with: identifier as a non-nullable String, token as a unique non-nullable String, and expires as a non-nullable DateTime. Use a composite unique constraint over identifier and token using @@unique([identifier, token]). Map this model to the table name "verification_tokens".

### Step 6: Add the AuditLog Model

Define the AuditLog model with the following fields. The id field should be a String primary key defaulting to cuid(). The tenantId field is a nullable String — null for super admin events. The actorId field is a nullable String holding the UUID of the user who triggered the event; it is nullable because failed login attempts may not resolve to a real user. The actorRole field is a non-nullable String that records the role at the time of the event (or the literal string "UNKNOWN" for unresolved actors). The entityType field is a non-nullable String describing what kind of entity was acted upon — for example "User", "Sale", or "ProductVariant". The entityId field is a non-nullable String holding the UUID of the entity involved. The action field is a non-nullable String holding the event name — for example "LOGIN_SUCCESS", "LOGIN_FAILED", or "SALE_VOIDED". The before field is a nullable Json storing a snapshot of the entity state before the action was taken. The after field is a nullable Json storing a snapshot of the entity state after the action was taken. The ipAddress field is a nullable String. The userAgent field is a nullable String. The createdAt field is a non-nullable DateTime defaulting to now().

Add an index on actorId, an index on tenantId, an index on entityType and entityId together, and an index on createdAt to support time-ranged audit report queries. Map this model to the table name "audit_logs".

Do not add a foreign key constraint from AuditLog.actorId to User.id. The audit log is an append-only ledger and must remain intact even if a user record is hard-deleted. Denormalizing the actorId as a plain string prevents orphaned record issues.

### Step 7: Run the Prisma Migration

From the project root, run the generate and migrate command. Execute pnpm prisma migrate dev --name add_auth_models in the terminal. Prisma will inspect the schema diff, generate a new SQL migration file under prisma/migrations/, and apply it to the development database. Review the generated SQL in the migration file and confirm that all tables, enums, columns, indexes, and constraints match the schema definitions above.

### Step 8: Regenerate the Prisma Client

After the migration succeeds, run pnpm prisma generate to regenerate the Prisma Client with TypeScript types reflecting the new models. Confirm that the @prisma/client package now exposes the User, Session, VerificationToken, and AuditLog types.

### Step 9: Verify the Migration in the Database

Connect to the PostgreSQL development database using your preferred database client (for example, psql, TablePlus, or pgAdmin). Confirm that the tables "users", "sessions", "verification_tokens", and "audit_logs" exist with the correct column definitions and that the "UserRole" enum type has been created in the database schema.

---

## Expected Output

- prisma/schema.prisma contains the UserRole enum and all four new models fully defined
- A new migration file exists under prisma/migrations/ named with a timestamp prefix and the suffix "add_auth_models"
- The migration SQL creates the four tables with all columns, the UserRole enum, and all named indexes
- pnpm prisma generate completes without errors
- All four tables are visible and correctly structured in the development database
- The Prisma Client TypeScript types for User, Session, VerificationToken, and AuditLog are available for import in application code

---

## Validation

- [ ] prisma/schema.prisma compiles without errors when running pnpm prisma validate
- [ ] The migration file exists in prisma/migrations/ and its name ends with "add_auth_models"
- [ ] The "users" table has all required columns including sessionVersion and deletedAt
- [ ] The "audit_logs" table has all required columns and actorId is nullable with no foreign key constraint
- [ ] The "sessions" table has a cascade delete foreign key to "users"
- [ ] The "verification_tokens" table has a composite unique index on (identifier, token)
- [ ] pnpm prisma generate produces no TypeScript errors
- [ ] Running pnpm tsc --noEmit after regeneration shows no errors related to Prisma types

---

## Notes

- The tenantId on User intentionally has no foreign key to Tenant at this stage because the Tenant model does not yet exist. The foreign key relation will be added in SubPhase 01.03.
- The AuditLog.actorId is deliberately not a foreign key to avoid referential integrity issues when audit records outlive the referenced user. If the user is soft-deleted, the actorId still records the historical event correctly.
- The pin field will remain null for all users until the user sets up a PIN in Phase 4 Staff Management. The PIN login flow in Task 01.02.04 must handle the null case gracefully.
- The permissions Json field is designed to hold an array of permission strings that override or supplement the role defaults defined in the RBAC constants. This approach allows fine-grained per-user adjustments without creating a separate permissions table.
- Cost factor 12 for bcrypt is the minimum. Do not reduce this value. Higher factors are acceptable if the hardware supports it without unacceptable latency.
