# Units: only offer actions the server accepts

Every unit row rendered Deactivate and Delete. The server correctly rejects
deactivating a built-in unit (`BUILT_IN_UNIT`, 400) and deleting a unit used by
raw materials (`UNIT_IN_USE`, 409), and the delete dialog advised "deactivate
them instead" even though the failing built-ins cannot be deactivated
(ARGUS #479).

## Capability rules

`unitCapabilities()` in `src/lib/services/rawMaterialUnitCapabilities.core.ts`
is the single source for the table:

| Condition                    | Deactivate | Activate | Delete |
| ---------------------------- | ---------- | -------- | ------ |
| Custom, active, unused       | shown      | -        | shown  |
| Custom, inactive             | -          | shown    | shown  |
| Built-in, active             | hidden     | -        | hidden (protected) |
| Any unit with `usageCount > 0` | unchanged | unchanged | disabled with reason |

- Built-ins are marked with a **Built-in** badge and the page explains they can
  be renamed but not deactivated or deleted.
- ARGUS #483: built-ins are also protected from deletion server-side, and the
  lazy seeder revives a built-in that was soft-deleted before the guard existed.
- Delete is disabled while `usageCount > 0`; its tooltip explains that the
  materials must be removed or reassigned first.
- The **Used by** column now discloses archived references, e.g.
  `1 material (4 archived)`.
- The delete dialog no longer suggests deactivation. It states that in-use units
  cannot be deleted and that the materials must be reassigned first.
- Editing (rename / short label) remains available for built-ins, matching the
  server, which only blocks deactivation/deletion.

The server guards (`BUILT_IN_UNIT`, `UNIT_IN_USE`) are unchanged apart from the
delete guard, and remain the final authority; `isBuiltIn` and
`archivedUsageCount` are returned by `GET /api/store/units` so the UI can mirror
them.

## Verification

`src/lib/services/__tests__/rawMaterialUnitCapabilities.core.test.ts` covers
built-in deactivation and deletion, in-use deletion (singular/plural),
activation of an inactive custom unit, editing built-ins and the zero-usage
boundary. `src/lib/units/__tests__/unitUsage.core.test.ts` covers the archived
usage copy.
