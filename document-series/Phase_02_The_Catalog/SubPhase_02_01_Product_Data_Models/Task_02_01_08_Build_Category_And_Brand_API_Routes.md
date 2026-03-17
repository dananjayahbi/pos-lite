# Task 02.01.08 — Build Category And Brand API Routes

## Metadata

| Property             | Value                                                    |
| -------------------- | -------------------------------------------------------- |
| Sub-Phase            | 02.01 — Product & Variant Data Models                    |
| Phase                | 02 — The Catalog                                         |
| Estimated Complexity | Low                                                      |
| Dependencies         | Task_02_01_06 (Product service layer must be implemented) |

---

## Objective

Create the Next.js App Router Route Handlers for the category and brand endpoints, enforcing authentication, tenant isolation, and the standard response envelope on all routes.

---

## Instructions

### Step 1: Review the Route File Conventions

Before creating the route files, confirm the existing API route structure established in Phase 01. All Route Handlers in VelvetPOS follow the same pattern: import the auth() function from the NextAuth configuration; call auth() at the start of the handler to retrieve the session; return a 401 immediately if no session is present; extract tenantId from session.user.tenantId; call the appropriate service function; wrap the response in the standard envelope.

The standard success envelope is a JSON object with a success field set to true and a data field containing the response payload. The standard error envelope has success set to false and an error field containing a code string and a message string. HTTP status codes map to: 200 for successful reads, 201 for successful creates, 400 for validation errors, 401 for missing authentication, 403 for insufficient permissions, 404 for not-found errors, 409 for conflict errors, and 500 for unexpected server errors.

### Step 2: Create the Category List and Create Route

Create the file src/app/api/categories/route.ts. This file exports two named functions: GET and POST.

The GET handler calls auth() to retrieve and validate the session. If no session is returned, it responds with a 401 status and an error envelope with code "UNAUTHORIZED". Otherwise, it reads tenantId from the session and calls getAllCategories(tenantId) from the product service. It returns the result wrapped in the success envelope with a 200 status.

The POST handler calls auth() and validates the session. It checks whether the authenticated user has the product:create permission using the permission checking utility from Phase 01's RBAC module — if not, it returns a 403 envelope. It reads the JSON body from the request and passes it to the CategorySchema Zod validator from the validators module (Task 02.01.10). If validation fails, it returns a 400 envelope with the Zod error details formatted as a flat array of field-path and message pairs. If validation passes, it calls createCategory(tenantId, validatedData) and returns the created category in a 201 envelope.

### Step 3: Create the Category Detail, Update, and Delete Route

Create the file src/app/api/categories/[id]/route.ts. This exports GET, PATCH, and DELETE handlers.

The GET handler validates the session and calls getCategoryById(tenantId, params.id) — this function can be added to the product service as a simple findUnique with tenant verification. Return 404 if not found.

The PATCH handler validates the session, checks for the product:edit permission (or a dedicated category:edit permission if defined in the RBAC system), parses and validates the request body against a partial CategorySchema, and calls updateCategory(tenantId, params.id, validatedData). Return the updated category in a 200 envelope.

The DELETE handler validates the session, checks for the product:delete permission, and calls softDeleteCategory(tenantId, params.id, session.user.id). The service will throw a conflict error if products are still assigned to this category. Catch this error in the Route Handler and return a 409 envelope with code "CATEGORY_IN_USE" and a message explaining that the category cannot be deleted while it has associated products.

### Step 4: Create the Brand List and Create Route

Create the file src/app/api/brands/route.ts following the exact same pattern as the category list route. The GET handler calls getAllBrands(tenantId). The POST handler validates the body against BrandSchema and calls createBrand(tenantId, validatedData). Both handlers follow the same session validation and envelope wrapping pattern.

### Step 5: Create the Brand Detail, Update, and Delete Route

Create the file src/app/api/brands/[id]/route.ts. Follow the same pattern as the category detail route. The DELETE handler catches conflict errors thrown by softDeleteBrand when products reference the brand, returning a 409 with code "BRAND_IN_USE".

### Step 6: Consistent Error Handling

For all Route Handlers across both files, wrap the main business logic in a try/catch block. Distinguish between known error types (not-found, conflict, validation, authorization) and unexpected errors. For unexpected errors, log the full error to the server console and return a 500 envelope with code "INTERNAL_SERVER_ERROR" and a generic message. Never expose stack traces or internal error messages to the client response.

---

## Expected Output

- Four route files exist: src/app/api/categories/route.ts, src/app/api/categories/[id]/route.ts, src/app/api/brands/route.ts, src/app/api/brands/[id]/route.ts
- All routes return 401 for unauthenticated requests
- All write routes return 403 when the user lacks the required permission
- DELETE routes return 409 Conflict when the resource is in use
- All responses use the standard success/error envelope structure

---

## Validation

- [ ] GET /api/categories returns 401 without a valid session
- [ ] GET /api/categories returns an array of categories (empty or populated) for an authenticated tenant
- [ ] POST /api/categories with a duplicate name returns 409 (conflict raised by service layer)
- [ ] DELETE /api/categories/[id] when the category has products returns 409 with code "CATEGORY_IN_USE"
- [ ] DELETE /api/categories/[id] when the category is empty returns 200 and the soft-deleted category
- [ ] Same patterns confirmed for /api/brands routes
- [ ] pnpm tsc --noEmit passes with no type errors in any of the four route files

---

## Notes

The tenantId used in all service calls must always come from the authenticated session (session.user.tenantId) and never from the request body, query parameters, or URL path. Even if a client sends a different tenantId in the request body, it is ignored. This is the fundamental multi-tenant isolation guarantee enforced at the Route Handler level.

The Route Handler should only catch errors at the outermost try/catch. Avoid deeply nested try/catch blocks. Use explicit error type checks (for example, checking an error's code property or message string) to distinguish service-layer error types from unexpected system errors. A future improvement will introduce a custom AppError class for the service layer that carries a status code and error code — this will make Route Handler error handling even more mechanical, but for now, checking error message patterns is acceptable.
