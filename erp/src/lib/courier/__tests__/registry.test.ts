import { describe, it, expect } from 'vitest';
import {
  courierProviderRegistry,
  getRegisteredProviders,
  isProviderRegistered,
  resolveCourierAdapter,
  resolveAdapterForAccount,
} from '@/lib/courier/registry';
import { COURIER_PROVIDER_CONFIG, getCourierProviderConfig } from '@/lib/courier/config';

describe('courierProviderRegistry', () => {
  it('registers Trans Express as the only implemented provider', () => {
    expect(isProviderRegistered('TRANSEXPRESS')).toBe(true);
    expect(getRegisteredProviders()).toEqual(['TRANSEXPRESS']);
  });

  it('resolves the Trans Express adapter', () => {
    const adapter = resolveCourierAdapter('TRANSEXPRESS');
    expect(adapter.provider).toBe('TRANSEXPRESS');
    expect(typeof adapter.authenticate).toBe('function');
    expect(typeof adapter.uploadSingle).toBe('function');
    expect(typeof adapter.track).toBe('function');
    expect(typeof adapter.syncLocations).toBe('function');
    expect(typeof adapter.mapStatus).toBe('function');
  });

  it('resolves an adapter from a CourierAccount-shaped object', () => {
    const adapter = resolveAdapterForAccount({ provider: 'TRANSEXPRESS' });
    expect(adapter.provider).toBe('TRANSEXPRESS');
  });

  it('throws UNSUPPORTED_COURIER_PROVIDER for enum-only providers', () => {
    expect(() => resolveCourierAdapter('DOMEX')).toThrow('UNSUPPORTED_COURIER_PROVIDER');
    expect(() => resolveCourierAdapter('PROMPTX')).toThrow('UNSUPPORTED_COURIER_PROVIDER');
    expect(() => resolveCourierAdapter('KOOMBIYO')).toThrow('UNSUPPORTED_COURIER_PROVIDER');
  });

  it('reports future providers as not registered', () => {
    expect(isProviderRegistered('DOMEX')).toBe(false);
    expect(isProviderRegistered('PROMPTX')).toBe(false);
    expect(isProviderRegistered('KOOMBIYO')).toBe(false);
  });
});

describe('COURIER_PROVIDER_CONFIG', () => {
  it('describes Trans Express as implemented with credential fields', () => {
    const cfg = getCourierProviderConfig('TRANSEXPRESS');
    expect(cfg.implemented).toBe(true);
    expect(cfg.label).toBe('Trans Express');
    expect(cfg.authFields).toEqual(['email', 'password', 'apiKey']);
    expect(cfg.baseUrls.STAGING).toBeDefined();
    expect(cfg.baseUrls.PRODUCTION).toBeDefined();
  });

  it('declares Domex/PromptX/Koombiyo as not implemented', () => {
    expect(COURIER_PROVIDER_CONFIG.DOMEX.implemented).toBe(false);
    expect(COURIER_PROVIDER_CONFIG.PROMPTX.implemented).toBe(false);
    expect(COURIER_PROVIDER_CONFIG.KOOMBIYO.implemented).toBe(false);
  });

  it('has a config entry for every enum-only provider value', () => {
    expect(COURIER_PROVIDER_CONFIG.DOMEX).toBeDefined();
    expect(COURIER_PROVIDER_CONFIG.PROMPTX).toBeDefined();
    expect(COURIER_PROVIDER_CONFIG.KOOMBIYO).toBeDefined();
  });
});
