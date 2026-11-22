import { describe, expect, it } from 'vitest';

import {
  hardwareSettingsAuditPayload,
  mergeHardwareSettings,
  readHardwareSettings,
  validateHardwareSettings,
} from '@/lib/settings/hardwareSettings.core';

/**
 * ARGUS #510 — the saved printer address must be visible with both stored
 * shapes, PATCH must be able to change it, and only NETWORK needs a host.
 */

const NESTED = {
  hardware: {
    printer: { type: 'NETWORK', host: '192.168.1.100', port: 9100 },
    cashDrawerEnabled: true,
    cfdEnabled: false,
  },
};

const FLAT = {
  hardware: {
    type: 'NETWORK',
    host: '192.168.1.100',
    port: 9100,
    cashDrawerEnabled: true,
    cfdEnabled: false,
  },
};

describe('readHardwareSettings', () => {
  it('reads the canonical nested shape', () => {
    expect(readHardwareSettings(NESTED)).toEqual({
      printerType: 'NETWORK',
      host: '192.168.1.100',
      port: 9100,
      cashDrawerEnabled: true,
      cfdEnabled: false,
    });
  });

  it('reads the flat seed/legacy shape instead of showing blanks', () => {
    expect(readHardwareSettings(FLAT)).toEqual({
      printerType: 'NETWORK',
      host: '192.168.1.100',
      port: 9100,
      cashDrawerEnabled: true,
      cfdEnabled: false,
    });
  });

  it('prefers the nested value when both shapes exist', () => {
    const mixed = {
      hardware: {
        type: 'USB',
        host: '10.0.0.2',
        port: 1,
        printer: { type: 'NETWORK', host: '192.168.1.101', port: 9101 },
      },
    };
    expect(readHardwareSettings(mixed)).toMatchObject({
      printerType: 'NETWORK',
      host: '192.168.1.101',
      port: 9101,
    });
  });

  it('falls back to defaults for missing or invalid values', () => {
    expect(readHardwareSettings(null)).toEqual({
      printerType: 'NETWORK',
      host: '',
      port: 9100,
      cashDrawerEnabled: false,
      cfdEnabled: false,
    });
    expect(readHardwareSettings({ hardware: { printer: { port: 70000 } } }).port).toBe(9100);
  });
});

describe('mergeHardwareSettings', () => {
  const current = readHardwareSettings(FLAT);

  it('keeps stored fields that a partial PATCH omits', () => {
    expect(mergeHardwareSettings(current, { cashDrawerEnabled: false })).toEqual({
      printerType: 'NETWORK',
      host: '192.168.1.100',
      port: 9100,
      cashDrawerEnabled: false,
      cfdEnabled: false,
    });
  });

  it('allows an explicit host change', () => {
    const next = mergeHardwareSettings(current, { host: '192.168.1.50' });
    expect(next.host).toBe('192.168.1.50');
  });
});

describe('validateHardwareSettings', () => {
  it('requires a host only for NETWORK printers', () => {
    expect(
      validateHardwareSettings({ ...readHardwareSettings(FLAT), host: '' }),
    ).toBe('Host is required for network printers');
    expect(
      validateHardwareSettings({
        ...readHardwareSettings(FLAT),
        printerType: 'USB',
        host: '',
      }),
    ).toBeNull();
  });
});

describe('hardwareSettingsAuditPayload', () => {
  it('captures hardware fields only, never unrelated settings', () => {
    const before = readHardwareSettings({ ...FLAT, apiKey: 'should-not-leak' });
    const after = mergeHardwareSettings(before, { host: '10.1.1.1' });
    const payload = hardwareSettingsAuditPayload(before, after);

    expect(payload.before.host).toBe('192.168.1.100');
    expect(payload.after.host).toBe('10.1.1.1');
    expect(Object.keys(payload.after).sort()).toEqual([
      'cashDrawerEnabled',
      'cfdEnabled',
      'host',
      'port',
      'printerType',
    ]);
  });
});
