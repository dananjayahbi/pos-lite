import { describe, expect, it } from 'vitest';
import {
  POS_SHORTCUT_HELP,
  isEditableTarget,
  matchesShortcut,
  normalizeShortcutKey,
} from '@/lib/pos/keyboard';

const input = { tagName: 'INPUT', type: 'text' };
const numberInput = { tagName: 'INPUT', type: 'number' };
const checkbox = { tagName: 'INPUT', type: 'checkbox' };
const button = { tagName: 'BUTTON' };
const editableDiv = { tagName: 'DIV', isContentEditable: true };
const body = { tagName: 'BODY' };

const event = (overrides: Record<string, unknown> = {}) => ({
  key: 'F2',
  target: body,
  repeat: false,
  ctrlKey: false,
  altKey: false,
  metaKey: false,
  shiftKey: false,
  ...overrides,
});

describe('normalizeShortcutKey', () => {
  it('lower-cases function keys and letters', () => {
    expect(normalizeShortcutKey('F2')).toBe('f2');
    expect(normalizeShortcutKey('C')).toBe('c');
  });

  it('maps the spacebar to a readable token', () => {
    expect(normalizeShortcutKey(' ')).toBe('space');
  });

  it('keeps punctuation bindings intact', () => {
    expect(normalizeShortcutKey('?')).toBe('?');
    expect(normalizeShortcutKey('/')).toBe('/');
    expect(normalizeShortcutKey('+')).toBe('+');
  });
});

describe('isEditableTarget', () => {
  it('treats text-entry fields as editable', () => {
    expect(isEditableTarget(input)).toBe(true);
    expect(isEditableTarget(numberInput)).toBe(true);
    expect(isEditableTarget({ tagName: 'TEXTAREA' })).toBe(true);
    expect(isEditableTarget({ tagName: 'SELECT' })).toBe(true);
    expect(isEditableTarget(editableDiv)).toBe(true);
  });

  it('does not block shortcuts on buttons, checkboxes, or the page body', () => {
    expect(isEditableTarget(button)).toBe(false);
    expect(isEditableTarget(checkbox)).toBe(false);
    expect(isEditableTarget(body)).toBe(false);
    expect(isEditableTarget(null)).toBe(false);
    expect(isEditableTarget(undefined)).toBe(false);
  });
});

describe('matchesShortcut', () => {
  it('matches function keys even while a text field has focus when opted in', () => {
    expect(matchesShortcut(event({ target: input }), { key: 'F2', allowInEditable: true })).toBe(true);
  });

  it('refuses printable shortcuts inside a text field by default', () => {
    expect(matchesShortcut(event({ key: '/', target: input }), { key: '/' })).toBe(false);
  });

  it('matches printable shortcuts outside text fields', () => {
    expect(matchesShortcut(event({ key: '/', target: body }), { key: '/' })).toBe(true);
  });

  it('requires an exact modifier combination', () => {
    expect(matchesShortcut(event({ key: 'c', altKey: true }), { key: 'C', alt: true })).toBe(true);
    expect(matchesShortcut(event({ key: 'c' }), { key: 'C', alt: true })).toBe(false);
    expect(matchesShortcut(event({ key: 'c', altKey: true }), { key: 'C' })).toBe(false);
    expect(matchesShortcut(event({ key: 'F4', ctrlKey: true }), { key: 'F4' })).toBe(false);
  });

  it('ignores auto-repeat unless opted in', () => {
    expect(matchesShortcut(event({ key: 'F4', repeat: true }), { key: 'F4' })).toBe(false);
    expect(
      matchesShortcut(event({ key: 'F4', repeat: true }), { key: 'F4', allowRepeat: true }),
    ).toBe(true);
  });

  it('matches the help shortcut only with shift', () => {
    expect(matchesShortcut(event({ key: '?', shiftKey: true }), { key: '?', shift: true })).toBe(true);
    expect(matchesShortcut(event({ key: '?' }), { key: '?', shift: true })).toBe(false);
  });

  it('documents every shortcut the screen implements', () => {
    const keys = POS_SHORTCUT_HELP.flatMap((entry) => entry.keys);
    for (const expected of [
      'F2',
      'F4',
      'F8',
      'F9',
      '?',
      'Alt',
      'Shift',
      'C',
      'A',
      'U',
      'D',
      'P',
      'Enter',
      'Delete',
    ]) {
      expect(keys).toContain(expected);
    }
  });
});
