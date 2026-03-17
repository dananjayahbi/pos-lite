# Task 01.02.06 — Build RBAC Permission System

## Metadata

- **Sub-Phase:** 01.02 — Authentication, RBAC & Session Management
- **Phase:** 01 — The Foundation
- **Estimated Complexity:** Medium
- **Dependencies:** Task_01_02_01 (User model with role and permissions fields exists)

---

## Objective

Define all 50+ named permission constants grouped by domain, map each role to its default permission set, and create both a server-side hasPermission utility and a client-side usePermissions hook to enable consistent permission checks across the entire VelvetPOS codebase.

---

## Instructions

### Step 1: Design the Permission Model

VelvetPOS uses a hybrid permission model. Each role has a default permission set defined as a static constant (the ROLE_PERMISSIONS map). Individual users may have their permission set customised by an OWNER or Manager via the staff management UI (built in Phase 4). The effective permissions for any user are the contents of the User.permissions JSON field, which is pre-populated from ROLE_PERMISSIONS at user creation time and may later be adjusted per-user. The RBAC system always reads from User.permissions (stored in the JWT) rather than deriving permissions from the role at runtime, allowing per-user overrides without touching the role field.

### Step 2: Create the Permissions Constants File

Create the file src/lib/constants/permissions.ts. This file exports a single PERMISSIONS object (preferred over a TypeScript enum to allow easy string comparison and iteration). The object should be structured into nested groups by domain. Each key within a group is a short descriptive name (camelCase, such as "createSale") and each value is the full permission string (using the colon-separated namespace format, such as "sale:create").

Define the following permission groups and their member permissions:

The SALE group should include: createSale ("sale:create"), viewSale ("sale:view"), voidSale ("sale:void"), refundSale ("sale:refund").

The DISCOUNT group should include: applyDiscount ("discount:apply"), overrideDiscount ("discount:override"), viewDiscount ("discount:view").

The PRODUCT group should include: createProduct ("product:create"), editProduct ("product:edit"), deleteProduct ("product:delete"), viewProduct ("product:view"), viewCostPrice ("product:view_cost_price"), archiveProduct ("product:archive").

The STOCK group should include: adjustStock ("stock:adjust"), conductStockTake ("stock:take"), approveStockTake ("stock:take:approve"), viewStock ("stock:view").

The CUSTOMER group should include: createCustomer ("customer:create"), editCustomer ("customer:edit"), deleteCustomer ("customer:delete"), viewCustomer ("customer:view"), viewCustomerBalance ("customer:view_balance").

The SUPPLIER group should include: createSupplier ("supplier:create"), editSupplier ("supplier:edit"), viewSupplier ("supplier:view"), createPurchaseOrder ("purchase_order:create"), receivePurchaseOrder ("purchase_order:receive"), approvePurchaseOrder ("purchase_order:approve").

The STAFF group should include: manageStaff ("staff:manage"), viewStaff ("staff:view"), openShift ("shift:open"), closeShift ("shift:close"), viewShift ("shift:view").

The REPORT group should include: viewSalesReport ("report:view_sales"), viewProfitReport ("report:view_profit"), exportReport ("report:export"), viewCostReport ("report:view_cost").

The SETTINGS group should include: manageSettings ("settings:manage"), viewSettings ("settings:view"), manageTax ("settings:tax"), manageHardware ("settings:hardware"), manageUsers ("settings:users").

The PROMOTION group should include: createPromotion ("promotion:create"), editPromotion ("promotion:edit"), deletePromotion ("promotion:delete").

Also export a flat ALL_PERMISSIONS array that is the union of all values from all groups, for use in the Super Admin seeder and in owner-level permission assignment.

### Step 3: Define the Role Permissions Map

In the same file, export the ROLE_PERMISSIONS constant as a plain object mapping each role string to an array of permission strings. The mapping should be:

For OWNER: all permissions from ALL_PERMISSIONS (the OWNER has full store access with no restrictions).

For MANAGER: all permissions except archiveProduct (product:archive is an owner-level destructive action), deleteCustomer, deleteProduct, manageSettings (settings:manage — billing is off limits), manageUsers (staff management is limited), approvePurchaseOrder, and deletePromotion. The MANAGER can see cost prices and profit reports. Include viewCostPrice and viewProfitReport explicitly.

For CASHIER: only the following permissions — createSale, viewSale, applyDiscount, viewProduct, viewCustomer, createCustomer, openShift, closeShift. The CASHIER must not have viewCostPrice or any report or stock management permissions.

For STOCK_CLERK: only the following permissions — viewProduct, viewStock, adjustStock, conductStockTake, viewCostPrice, createPurchaseOrder, receivePurchaseOrder, viewSupplier.

SUPER_ADMIN is intentionally excluded from ROLE_PERMISSIONS because SUPER_ADMIN access is controlled purely by role-based route enforcement in middleware, not by individual permissions. The SUPER_ADMIN has platform-level access to all tenant management functions that do not map to the store-level permission set.

### Step 4: Create the Server-Side Permission Utility

Create the file src/lib/utils/permissions.ts. This file should export a single function named hasPermission. The function accepts two parameters: a user object (with at minimum a permissions field typed as a string array or unknown Json type from Prisma) and a permission string. The function should safely extract the permissions array from the user object (handling the Prisma Json type with a type guard or explicit cast), then check whether the permission string is present in the array using Array.prototype.includes. Return true if found, false otherwise. Also handle the edge case where the user's permissions field is null or undefined by returning false.

Export an optional second overload or helper function named requirePermission that takes the same arguments and throws a standard permissions error (an object with a status 403 code and a message "Forbidden: insufficient permissions") when the permission is not present. This helper is used in Route Handlers to guard API endpoints before processing the request.

### Step 5: Create the Client-Side usePermissions Hook

Create the file src/hooks/usePermissions.ts as a client-side React hook (no "use client" directive needed at the hook file level, but the hook uses useSession which requires client context). Import useSession from next-auth/react. The hook reads the session and extracts the permissions array from session.user.permissions. Return an object with a single property: hasPermission, which is a function accepting a permission string and returning a boolean. The function checks whether the permission string is present in the session's permissions array.

Also return a second property isLoading that is true when the session status is "loading", so callers can show a loading state or skeleton UI before the session permissions are resolved.

Include a type export for a PermissionKey type that is a string union of all values in the PERMISSIONS object (derived using typeof PERMISSIONS[keyof typeof PERMISSIONS]) to allow TypeScript callers to get autocomplete and type checking when passing permission strings.

### Step 6: Verify Coverage

Manually count the permissions defined across all groups in the constants file and confirm the total is 50 or more. Review the ROLE_PERMISSIONS map and confirm that CASHIER does not include any cost price, report, or stock management permissions. Confirm that STOCK_CLERK does not include sale:create or any customer editDelete permissions.

---

## Expected Output

- src/lib/constants/permissions.ts exports PERMISSIONS (grouped object), ALL_PERMISSIONS (flat array), and ROLE_PERMISSIONS (role to permissions map)
- Total permission count in ALL_PERMISSIONS is 50 or more
- CASHIER permissions exclude all cost price, profit report, and stock management permissions
- src/lib/utils/permissions.ts exports hasPermission and requirePermission functions with correct logic
- src/hooks/usePermissions.ts exports a usePermissions hook returning hasPermission(permission) and isLoading
- pnpm tsc --noEmit passes without errors in all three new files

---

## Validation

- [ ] PERMISSIONS object is defined with all domain groups present
- [ ] ALL_PERMISSIONS array contains 50 or more unique permission strings with no duplicates
- [ ] ROLE_PERMISSIONS.CASHIER does not include "product:view_cost_price"
- [ ] ROLE_PERMISSIONS.CASHIER does not include "report:view_profit"
- [ ] ROLE_PERMISSIONS.STOCK_CLERK does not include "sale:create"
- [ ] ROLE_PERMISSIONS.OWNER includes every permission in ALL_PERMISSIONS
- [ ] hasPermission returns true for a permission present in the user's permissions array
- [ ] hasPermission returns false for a permission absent from the user's permissions array
- [ ] hasPermission returns false when the user permissions field is null or undefined
- [ ] requirePermission throws a 403 error object when the permission is not present
- [ ] usePermissions hook returns isLoading: true when session status is "loading"
- [ ] usePermissions hook returns hasPermission function that correctly reads session.user.permissions
- [ ] pnpm tsc --noEmit passes with no errors

---

## Notes

- The permissions are stored as a JSON array of strings in the database. When a new user is created (in Phase 4 Staff Management), copy the appropriate ROLE_PERMISSIONS array into the User.permissions field as the initial value. Subsequent per-user modifications update this array directly.
- The PERMISSIONS object structure (nested groups) is for developer ergonomics only. The actual permission values stored in the database and JWT are the flat strings (e.g., "sale:create"), not the nested key paths.
- Never use the role field alone to gate individual UI elements or API routes. Always use the permissions array. This offers greater flexibility — for example, a MANAGER might be granted the additional "settings:manage" permission for a specific store, which can be done by adding the string to their permissions array without changing their role.
- The PermissionKey type union provides IDE autocomplete when writing hasPermission("...") calls, preventing typos in permission strings. Export this type from the permissions constants file and import it in the hook and utility for consistent typing.
- SUPER_ADMIN bypasses the permissions system at the route level (enforced in middleware) and does not need individual permissions. Do not include SUPER_ADMIN in ROLE_PERMISSIONS and do not apply hasPermission checks to SUPER_ADMIN flows.
