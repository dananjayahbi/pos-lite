# Keyboard activation in category list rows

The category row is a `role="button"` with a keydown handler for Enter/Space.
Its pencil and delete buttons are children, so their key events bubbled to the
row: pressing Enter on the pencil selected the row and never opened Edit
(ARGUS #171).

## Rule

`shouldHandleRowKey(key, fromRowItself)`
(`src/lib/categories/categoryListKeyboard.core.ts`) returns true only when:

- the event originated on the row (`event.target === event.currentTarget`), and
- the key is `Enter` or `Space`.

Keys bubbling from the action buttons are ignored, so the browser's native
Enter/Space button activation runs and opens Edit or the delete confirmation.
The row itself still selects on Enter/Space, and Tab navigation is unchanged.

## Verification

`categoryListKeyboard.core.test.ts` covers row-origin Enter/Space, child-origin
Enter/Space and other keys. The same rule is applied to brands in #178.
