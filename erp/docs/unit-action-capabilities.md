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
| Built-in, active             | hidden     | -        | shown only when unused |
| Any unit with `usageCount > 0` | unchanged | unchanged | disabled with reason |

- Built-ins are marked with a **Built-in** badge and the page explains they can
  be renamed but not deactivated.
- Delete is disabled while `usageCount > 0`; its tooltip explains that the
  materials must be removed or reassigned first.
- The delete dialog no longer suggests deactivation. It states that in-use units
  cannot be deleted and that the materials must be reassigned first.
- Editing (rename / short label) remains available for built-ins, matching the
  server, which only blocks deactivation.

The server guards (`BUILT_IN_UNIT`, `UNIT_IN_USE`) are unchanged and remain the
final authority; `isBuiltIn` is now returned by `GET /api/store/units` so the UI
can mirror them.

## Verification

`src/lib/services/__tests__/rawMaterialUnitCapabilities.core.test.ts` covers
built-in deactivation, in-use deletion (singular/plural), activation of an
inactive custom unit, editing built-ins and the zero-usage boundary.
