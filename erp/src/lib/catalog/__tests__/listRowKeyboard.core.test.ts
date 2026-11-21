import { describe, expect, it } from 'vitest';

import { shouldHandleRowKey } from '@/lib/catalog/listRowKeyboard.core';

/** ARGUS #171: Enter/Space on a row action must not select the row. */
describe('shouldHandleRowKey', () => {
  it('activates the row for Enter and Space pressed on the row itself', () => {
    expect(shouldHandleRowKey('Enter', true)).toBe(true);
    expect(shouldHandleRowKey(' ', true)).toBe(true);
  });

  it('ignores keys that bubbled from the edit/delete buttons', () => {
    expect(shouldHandleRowKey('Enter', false)).toBe(false);
    expect(shouldHandleRowKey(' ', false)).toBe(false);
  });

  it('ignores other keys on the row', () => {
    expect(shouldHandleRowKey('Tab', true)).toBe(false);
    expect(shouldHandleRowKey('Escape', true)).toBe(false);
  });
});
