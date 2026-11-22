import { describe, expect, it } from 'vitest';
import {
  DEFAULT_LANKA_QR_INSTRUCTIONS,
  DEFAULT_LANKA_QR_SETTINGS,
  isRenderableQrImageUrl,
  lankaQrTenderRejection,
  parseLankaQrSettings,
  readLankaQrSettingsFromTenantSettings,
} from '@/lib/payments/lanka-qr-config';

describe('parseLankaQrSettings', () => {
  it('returns defaults when nothing is configured', () => {
    expect(parseLankaQrSettings(undefined)).toEqual(DEFAULT_LANKA_QR_SETTINGS);
    expect(parseLankaQrSettings(null)).toEqual(DEFAULT_LANKA_QR_SETTINGS);
    expect(parseLankaQrSettings('not-an-object')).toEqual(DEFAULT_LANKA_QR_SETTINGS);
  });

  it('keeps every configured field', () => {
    const parsed = parseLankaQrSettings({
      enabled: false,
      merchantName: '  AyurPOS Colombo  ',
      merchantId: ' MID-12345 ',
      bankName: 'Commercial Bank',
      qrImageUrl: 'https://cdn.example.com/lankaqr.png',
      instructions: 'Scan and pay.',
      referenceRequired: true,
      allowSplit: false,
    });

    expect(parsed).toEqual({
      enabled: false,
      merchantName: 'AyurPOS Colombo',
      merchantId: 'MID-12345',
      bankName: 'Commercial Bank',
      qrImageUrl: 'https://cdn.example.com/lankaqr.png',
      instructions: 'Scan and pay.',
      referenceRequired: true,
      allowSplit: false,
    });
  });

  it('falls back to defaults for invalid or empty values', () => {
    const parsed = parseLankaQrSettings({
      enabled: 'yes',
      merchantName: 42,
      instructions: '   ',
      referenceRequired: 'true',
    });

    expect(parsed.enabled).toBe(false);
    expect(parsed.merchantName).toBe('');
    expect(parsed.instructions).toBe(DEFAULT_LANKA_QR_INSTRUCTIONS);
    expect(parsed.referenceRequired).toBe(false);
  });

  it('only reports enabled when the merchant can actually be scanned', () => {
    expect(parseLankaQrSettings({ enabled: true }).enabled).toBe(false);
    expect(
      parseLankaQrSettings({
        enabled: true,
        merchantName: 'AyurPOS',
        qrImageUrl: 'https://cdn.example.com/qr.png',
      }).enabled,
    ).toBe(true);
    expect(
      parseLankaQrSettings({
        enabled: true,
        merchantName: 'AyurPOS',
        qrImageUrl: '',
      }).enabled,
    ).toBe(false);
    expect(
      parseLankaQrSettings({
        enabled: true,
        merchantName: '',
        qrImageUrl: 'https://cdn.example.com/qr.png',
      }).enabled,
    ).toBe(false);
  });

  it('truncates over-long strings instead of throwing', () => {
    const parsed = parseLankaQrSettings({ merchantName: 'x'.repeat(200) });
    expect(parsed.merchantName).toHaveLength(80);
  });

  it('honours an explicit `enabled: false`', () => {
    expect(parseLankaQrSettings({ enabled: false }).enabled).toBe(false);
  });
});

describe('readLankaQrSettingsFromTenantSettings', () => {
  it('reads the nested lankaQr block', () => {
    const settings = {
      vatRate: 18,
      lankaQr: { merchantName: 'AyurPOS', enabled: false },
    };
    const parsed = readLankaQrSettingsFromTenantSettings(settings);
    expect(parsed.merchantName).toBe('AyurPOS');
    expect(parsed.enabled).toBe(false);
  });

  it('returns defaults when the tenant settings are null or malformed', () => {
    expect(readLankaQrSettingsFromTenantSettings(null)).toEqual(DEFAULT_LANKA_QR_SETTINGS);
    expect(readLankaQrSettingsFromTenantSettings({ lankaQr: 'oops' })).toEqual(
      DEFAULT_LANKA_QR_SETTINGS,
    );
  });
});

describe('isRenderableQrImageUrl', () => {
  it('accepts absolute and root-relative URLs', () => {
    expect(isRenderableQrImageUrl('https://cdn.example.com/qr.png')).toBe(true);
    expect(isRenderableQrImageUrl('http://cdn.example.com/qr.png')).toBe(true);
    expect(isRenderableQrImageUrl('/uploads/lankaqr.png')).toBe(true);
  });

  it('rejects empty, relative and non-http schemes', () => {
    expect(isRenderableQrImageUrl('')).toBe(false);
    expect(isRenderableQrImageUrl('uploads/qr.png')).toBe(false);
    expect(isRenderableQrImageUrl('javascript:alert(1)')).toBe(false);
    expect(isRenderableQrImageUrl('ftp://cdn.example.com/qr.png')).toBe(false);
  });
});

describe('lankaQrTenderRejection (ARGUS #72)', () => {
  const configured = parseLankaQrSettings({
    enabled: true,
    merchantName: 'AyurPOS',
    qrImageUrl: 'https://cdn.example.com/qr.png',
    allowSplit: true,
  });

  it('ignores tenders that do not use LankaQR', () => {
    expect(lankaQrTenderRejection({ paymentMethod: 'CASH' }, DEFAULT_LANKA_QR_SETTINGS)).toBeNull();
    expect(lankaQrTenderRejection({ paymentMethod: 'SPLIT', splitLegMethod: 'CARD' }, DEFAULT_LANKA_QR_SETTINGS)).toBeNull();
  });

  it('blocks a direct LankaQR sale when no QR image is configured', () => {
    const unconfigured = parseLankaQrSettings({ enabled: true, merchantName: 'AyurPOS', qrImageUrl: '' });
    expect(lankaQrTenderRejection({ paymentMethod: 'LANKAQR' }, unconfigured)).toMatch(/not configured/i);
    expect(lankaQrTenderRejection({ paymentMethod: 'LANKAQR' }, DEFAULT_LANKA_QR_SETTINGS)).toMatch(/not configured/i);
  });

  it('blocks a split LankaQR leg when no QR image is configured', () => {
    const unconfigured = parseLankaQrSettings({ enabled: true, merchantName: 'AyurPOS', qrImageUrl: '' });
    expect(
      lankaQrTenderRejection({ paymentMethod: 'SPLIT', splitLegMethod: 'LANKAQR' }, unconfigured),
    ).toMatch(/not configured/i);
  });

  it('blocks a disabled or split-disallowed LankaQR tender', () => {
    expect(
      lankaQrTenderRejection(
        { paymentMethod: 'LANKAQR' },
        parseLankaQrSettings({ enabled: false, merchantName: 'AyurPOS', qrImageUrl: 'https://cdn.example.com/qr.png' }),
      ),
    ).toMatch(/disabled/i);
    expect(
      lankaQrTenderRejection(
        { paymentMethod: 'SPLIT', splitLegMethod: 'LANKAQR' },
        parseLankaQrSettings({
          enabled: true,
          merchantName: 'AyurPOS',
          qrImageUrl: 'https://cdn.example.com/qr.png',
          allowSplit: false,
        }),
      ),
    ).toMatch(/split payment/i);
  });

  it('allows a configured tender, including an allowed split leg', () => {
    expect(lankaQrTenderRejection({ paymentMethod: 'LANKAQR' }, configured)).toBeNull();
    expect(
      lankaQrTenderRejection({ paymentMethod: 'SPLIT', splitLegMethod: 'LANKAQR' }, configured),
    ).toBeNull();
  });
});
