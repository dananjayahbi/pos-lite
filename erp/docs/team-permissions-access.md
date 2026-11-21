# Team & Permissions access model

ARGUS #460. The page used `settings:users`, the roster API used `staff:view`
and the save API required `staff:manage` plus `staff:permissions:assign`.
Depending on the role, the page either showed a roster whose load 403'd or an
editable grid whose Save 403'd.

## Model

`src/lib/services/teamPermissionsAccess.core.ts`:

| Capability | Permission |
| --- | --- |
| view page/roster | `staff:view` |
| manage a member | `staff:manage` |
| change explicit permissions | `staff:permissions:assign` |
| Save control | manage AND assign |

`src/app/(store)/settings/users/page.tsx` is the server gate: it resolves the
effective permissions, redirects without `staff:view`, and passes the
capabilities to the client. The client shows Manage/Save/role/active controls
only when `canSave`; otherwise it is a read-only directory with an explanatory
note.

The `/staff` roster uses the same `staff:manage` key to show the create button
and the active-status switch; users without it see a status badge instead.

The PATCH route still enforces its own keys (`staff:manage`, and
`staff:permissions:assign` whenever `permissions` is present). The UI change is
defence in depth, not the authorization boundary.

## Verification

- `src/lib/services/__tests__/teamPermissionsAccess.core.test.ts`
- `npx tsc --noEmit`
