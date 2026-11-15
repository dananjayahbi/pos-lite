/**
 * POS keyboard/focus primitives.
 *
 * The POS terminal must be fully operable in three input modes:
 *   1. touch only (no keyboard, no pointer hover),
 *   2. keyboard only (no pointer at all),
 *   3. mouse + keyboard (the classic desktop flow).
 *
 * The helpers here keep the "always focused barcode input" contract and the
 * shortcut matching rules in one place so the grid, cart, and shell all agree
 * on when a key belongs to a text field and when it belongs to the terminal.
 */

/** Dom id of the single, always-focused POS barcode/search input. */
export const POS_BARCODE_INPUT_ID = 'pos-barcode-input';

/** Attribute marking the same input for querySelector-based refocusing. */
export const POS_BARCODE_INPUT_ATTR = 'data-pos-barcode-input';

export interface POSShortcutHelpEntry {
  /** Human-readable key caps, e.g. ['F2'] or ['Alt', 'C']. */
  keys: string[];
  label: string;
}

/** Single source of truth for the in-app shortcut guide (and docs). */
export const POS_SHORTCUT_HELP: POSShortcutHelpEntry[] = [
  { keys: ['F2'], label: 'Focus the barcode / search box' },
  { keys: ['Enter'], label: 'Add the scanned or searched product' },
  { keys: ['←', '→', '↑', '↓'], label: 'Move between products, then cart lines' },
  { keys: ['+', '−'], label: 'Increase / decrease the focused cart line' },
  { keys: ['Delete'], label: 'Remove the focused cart line' },
  { keys: ['F4'], label: 'Open payment (Charge / Pay)' },
  { keys: ['F8'], label: 'Hold the current sale' },
  { keys: ['F9'], label: 'Retrieve a held sale' },
  { keys: ['Alt', 'C'], label: 'Focus the customer search' },
  { keys: ['F1', '?'], label: 'Show this shortcut guide' },
  { keys: ['Esc'], label: 'Close a dialog, or clear the search' },
];

const NON_TEXT_INPUT_TYPES = new Set([
  'button',
  'submit',
  'reset',
  'checkbox',
  'radio',
  'range',
  'color',
  'file',
  'image',
]);

interface EditableLike {
  tagName?: string;
  isContentEditable?: boolean;
  type?: string;
}

/**
 * True when the event target is a field that consumes printable characters.
 * Accepts a structural shape so it can be unit-tested without a DOM.
 */
export function isEditableTarget(target: unknown): boolean {
  if (!target || typeof target !== 'object') return false;
  const el = target as EditableLike;
  if (el.isContentEditable) return true;
  const tag = el.tagName?.toUpperCase();
  if (tag === 'TEXTAREA' || tag === 'SELECT') return true;
  if (tag === 'INPUT') {
    const type = (el.type ?? 'text').toLowerCase();
    return !NON_TEXT_INPUT_TYPES.has(type);
  }
  return false;
}

/** Normalises `KeyboardEvent.key` for stable comparisons. */
export function normalizeShortcutKey(key: string): string {
  if (key === ' ') return 'space';
  if (key.length === 1) return key.toLowerCase();
  return key.toLowerCase();
}

export interface POSShortcutSpec {
  /** `KeyboardEvent.key`, compared case-insensitively (e.g. 'F2', '/', '?'). */
  key: string;
  /** Fire while a text field (including the barcode box) has focus. */
  allowInEditable?: boolean;
  /** Fire on held-key auto-repeat. Off by default so scans add once. */
  allowRepeat?: boolean;
  ctrl?: boolean;
  alt?: boolean;
  meta?: boolean;
  shift?: boolean;
}

interface ShortcutEventLike {
  key: string;
  repeat?: boolean;
  ctrlKey?: boolean;
  altKey?: boolean;
  metaKey?: boolean;
  shiftKey?: boolean;
  target?: unknown;
}

/**
 * Returns true when a keydown belongs to this shortcut.
 *
 * Modifiers must match exactly: a plain `F4` binding never fires on
 * `Ctrl+F4`, and printable shortcuts never fire inside a text field unless
 * `allowInEditable` is set (so typing "c" in the customer search cannot
 * trigger the Alt+C binding or a bare-letter shortcut).
 */
export function matchesShortcut(
  event: ShortcutEventLike,
  spec: POSShortcutSpec,
): boolean {
  if (normalizeShortcutKey(event.key) !== normalizeShortcutKey(spec.key)) {
    return false;
  }
  if (!spec.allowRepeat && event.repeat) return false;
  if (Boolean(event.ctrlKey) !== Boolean(spec.ctrl)) return false;
  if (Boolean(event.altKey) !== Boolean(spec.alt)) return false;
  if (Boolean(event.metaKey) !== Boolean(spec.meta)) return false;
  if (Boolean(event.shiftKey) !== Boolean(spec.shift)) return false;
  if (!spec.allowInEditable && isEditableTarget(event.target)) return false;
  return true;
}

/**
 * Puts the cursor back in the barcode/search box. Deliberately a no-op on the
 * server and when the POS screen is not mounted.
 */
export function focusPOSBarcodeInput(): void {
  if (typeof document === 'undefined') return;
  const input = document.getElementById(POS_BARCODE_INPUT_ID);
  if (input instanceof HTMLInputElement) {
    input.focus({ preventScroll: true });
  }
}

/**
 * True while a modal dialog owns focus. Global shortcuts and the scanner focus
 * guard use this so they never steal the cursor from an open payment/receipt
 * dialog.
 */
export function isPOSDialogOpen(): boolean {
  if (typeof document === 'undefined') return false;
  return Boolean(
    document.querySelector('[role="dialog"][data-state="open"], [role="alertdialog"][data-state="open"]'),
  );
}
