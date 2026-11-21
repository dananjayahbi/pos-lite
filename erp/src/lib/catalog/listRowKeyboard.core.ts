/**
 * Keyboard activation for selectable list rows that contain their own buttons
 * (ARGUS #171 / #178).
 *
 * The row is a `role="button"` with a keydown handler, and its edit/delete
 * buttons are children. A keydown on a child bubbles to the row, where
 * Enter/Space selected the row instead of activating the focused button. The
 * row must only handle keys that originate on the row itself.
 */

export function shouldHandleRowKey(key: string, fromRowItself: boolean): boolean {
  if (!fromRowItself) return false;
  return key === 'Enter' || key === ' ';
}
