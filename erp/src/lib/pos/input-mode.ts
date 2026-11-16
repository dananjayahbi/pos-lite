/**
 * POS input-mode preference.
 *
 * The terminal has two operating profiles:
 *
 * - `mouse-keyboard` (default) — the classic layout: product grid, category
 *   tabs and the cart. Touch screens use this profile too.
 * - `keyboard-only` — a scanner-first console with no product grid and no
 *   category tabs, leaving the whole screen for barcode entry and the ticket.
 *
 * The choice is a per-device preference (a till with no mouse should stay in
 * keyboard mode across reloads), so it lives in `localStorage` and is shared
 * between components through a tiny external store.
 */

export type POSInputMode = 'mouse-keyboard' | 'keyboard-only';

/** localStorage key holding the cashier's preferred POS profile. */
export const POS_INPUT_MODE_STORAGE_KEY = 'ayurpos.pos.input-mode';

/** Window event fired when the in-app selector changes the mode. */
export const POS_INPUT_MODE_EVENT = 'ayurpos:pos-input-mode';

export const DEFAULT_POS_INPUT_MODE: POSInputMode = 'mouse-keyboard';

export interface POSInputModeOption {
  value: POSInputMode;
  /** Full label for the selector. */
  label: string;
  /** Short label used when the header is tight. */
  shortLabel: string;
  /** One-line explanation for tooltips/help text. */
  description: string;
}

export const POS_INPUT_MODE_OPTIONS: readonly POSInputModeOption[] = [
  {
    value: 'mouse-keyboard',
    label: 'Mouse & keyboard',
    shortLabel: 'Mouse',
    description: 'Product grid, categories and cart - the classic desktop and touch layout.',
  },
  {
    value: 'keyboard-only',
    label: 'Keyboard only',
    shortLabel: 'Keyboard',
    description: 'Scanner-first console with no product grid or category tabs.',
  },
];

/** Storage surface needed for persistence (localStorage, or a test double). */
export interface POSInputModeStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

/** Unknown stored values fall back to the default profile. */
export function parsePOSInputMode(value: unknown): POSInputMode {
  return value === 'keyboard-only' ? 'keyboard-only' : DEFAULT_POS_INPUT_MODE;
}

export function resolvePOSInputModeStorage(
  storage?: POSInputModeStorage | null,
): POSInputModeStorage | null {
  if (storage) return storage;
  if (typeof window === 'undefined') return null;
  try {
    return window.localStorage;
  } catch {
    // Blocked storage (private mode / hardened browsers) must not break POS.
    return null;
  }
}

export function readPOSInputMode(storage?: POSInputModeStorage | null): POSInputMode {
  try {
    return parsePOSInputMode(
      resolvePOSInputModeStorage(storage)?.getItem(POS_INPUT_MODE_STORAGE_KEY),
    );
  } catch {
    return DEFAULT_POS_INPUT_MODE;
  }
}

export function writePOSInputMode(
  mode: POSInputMode,
  storage?: POSInputModeStorage | null,
): void {
  try {
    resolvePOSInputModeStorage(storage)?.setItem(POS_INPUT_MODE_STORAGE_KEY, mode);
  } catch {
    // Quota/private-mode failures keep the in-memory choice for this session.
  }
}

// ── External store ───────────────────────────────────────────────────────────

let cachedMode: POSInputMode | null = null;

/** `useSyncExternalStore` snapshot — stable until the mode actually changes. */
export function getPOSInputModeSnapshot(): POSInputMode {
  if (typeof window === 'undefined') return DEFAULT_POS_INPUT_MODE;
  if (cachedMode === null) cachedMode = readPOSInputMode();
  return cachedMode;
}

/** Server render (and the first hydration pass) always uses the default. */
export function getPOSInputModeServerSnapshot(): POSInputMode {
  return DEFAULT_POS_INPUT_MODE;
}

export function setPOSInputMode(
  mode: POSInputMode,
  storage?: POSInputModeStorage | null,
): void {
  cachedMode = mode;
  writePOSInputMode(mode, storage);
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event(POS_INPUT_MODE_EVENT));
  }
}

export function subscribePOSInputMode(listener: () => void): () => void {
  if (typeof window === 'undefined') return () => {};

  const onLocalChange = () => {
    // The setter already updated `cachedMode`; re-read for storage-event paths.
    listener();
  };
  const onStorage = (event: StorageEvent) => {
    if (event.key !== null && event.key !== POS_INPUT_MODE_STORAGE_KEY) return;
    cachedMode = null;
    listener();
  };

  window.addEventListener(POS_INPUT_MODE_EVENT, onLocalChange);
  window.addEventListener('storage', onStorage);
  return () => {
    window.removeEventListener(POS_INPUT_MODE_EVENT, onLocalChange);
    window.removeEventListener('storage', onStorage);
  };
}
