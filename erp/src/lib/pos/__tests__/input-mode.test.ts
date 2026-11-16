import { describe, expect, it } from 'vitest';
import {
  DEFAULT_POS_INPUT_MODE,
  POS_INPUT_MODE_OPTIONS,
  POS_INPUT_MODE_STORAGE_KEY,
  parsePOSInputMode,
  readPOSInputMode,
  writePOSInputMode,
  type POSInputModeStorage,
} from '@/lib/pos/input-mode';

function memoryStorage(initial: Record<string, string> = {}): POSInputModeStorage & {
  values: Record<string, string>;
} {
  const values = { ...initial };
  return {
    values,
    getItem: (key) => values[key] ?? null,
    setItem: (key, value) => {
      values[key] = value;
    },
  };
}

describe('parsePOSInputMode', () => {
  it('accepts both known profiles', () => {
    expect(parsePOSInputMode('mouse-keyboard')).toBe('mouse-keyboard');
    expect(parsePOSInputMode('keyboard-only')).toBe('keyboard-only');
  });

  it('falls back to the default for anything else', () => {
    expect(parsePOSInputMode(null)).toBe(DEFAULT_POS_INPUT_MODE);
    expect(parsePOSInputMode(undefined)).toBe(DEFAULT_POS_INPUT_MODE);
    expect(parsePOSInputMode('')).toBe(DEFAULT_POS_INPUT_MODE);
    expect(parsePOSInputMode('touch')).toBe(DEFAULT_POS_INPUT_MODE);
  });
});

describe('POS input mode persistence', () => {
  it('reads the stored profile', () => {
    const storage = memoryStorage({ [POS_INPUT_MODE_STORAGE_KEY]: 'keyboard-only' });
    expect(readPOSInputMode(storage)).toBe('keyboard-only');
  });

  it('defaults when nothing has been stored yet', () => {
    expect(readPOSInputMode(memoryStorage())).toBe('mouse-keyboard');
  });

  it('writes the chosen profile under the documented key', () => {
    const storage = memoryStorage();
    writePOSInputMode('keyboard-only', storage);
    expect(storage.values[POS_INPUT_MODE_STORAGE_KEY]).toBe('keyboard-only');
  });

  it('survives a blocked or broken storage implementation', () => {
    const broken: POSInputModeStorage = {
      getItem: () => {
        throw new Error('blocked');
      },
      setItem: () => {
        throw new Error('blocked');
      },
    };
    expect(readPOSInputMode(broken)).toBe('mouse-keyboard');
    expect(() => writePOSInputMode('keyboard-only', broken)).not.toThrow();
  });
});

describe('POS_INPUT_MODE_OPTIONS', () => {
  it('offers exactly the two profiles, with mouse & keyboard first (default)', () => {
    expect(POS_INPUT_MODE_OPTIONS.map((option) => option.value)).toEqual([
      'mouse-keyboard',
      'keyboard-only',
    ]);
    expect(POS_INPUT_MODE_OPTIONS[0]?.value).toBe(DEFAULT_POS_INPUT_MODE);
  });

  it('every option has a label, short label and description', () => {
    for (const option of POS_INPUT_MODE_OPTIONS) {
      expect(option.label.length).toBeGreaterThan(0);
      expect(option.shortLabel.length).toBeGreaterThan(0);
      expect(option.description.length).toBeGreaterThan(0);
    }
  });
});
