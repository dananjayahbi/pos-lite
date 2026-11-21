# Keyboard activation in brand list rows

The brand row is a `role="button"` with a keydown handler for Enter/Space, and
its pencil/delete buttons are children. Pressing Enter on the pencil selected
the brand instead of opening Edit (ARGUS #178), the same defect fixed for
categories in #171.

## Rule

Both lists now use the shared
`shouldHandleRowKey(key, fromRowItself)`
(`src/lib/catalog/listRowKeyboard.core.ts`): the row handles only Enter/Space
events whose `event.target` is the row itself. Keys bubbling from the action
buttons fall through to the browser's native button activation, so Enter opens
Edit and Space/Enter activates the delete control. Tab order and row selection
are unchanged.

## Verification

`src/lib/catalog/__tests__/listRowKeyboard.core.test.ts` covers row-origin and
child-origin Enter/Space plus other keys. `tsc --noEmit` passes.
