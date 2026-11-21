import { randomBytes } from 'node:crypto';
import { describe, expect, it } from 'vitest';

import {
  buildCourierSettingsPayload,
  hasCourierTestCredentials,
  resolveCourierSettingsUpdate,
  resolveCourierTestCredentials,
  validateCourierActivation,
  type CourierSettingsDraft,
} from '@/lib/courier/settings.core';

/**
 * ARGUS #513 — clearing a field must clear it, and activation must not save a
 * partial account. Secrets in this test are generated at runtime so no
 * credential-shaped literal lives in the repo.
 */
const SECRET = randomBytes(16).toString('hex');

function draft(overrides: Partial<CourierSettingsDraft> = {}): CourierSettingsDraft {
  return {
    env: 'STAGING',
    email: 'operator@example.com',
    password: '',
    apiKey: '',
    originDistrictId: '',
    originCityId: '',
    pickupAddress: '',
    isActive: false,
    ...overrides,
  };
}

describe('buildCourierSettingsPayload', () => {
  it('sends empty clearable fields instead of omitting them', () => {
    const payload = buildCourierSettingsPayload(draft({ email: '' }));
    expect(payload).toMatchObject({
      email: '',
      originDistrictId: null,
      originCityId: null,
      pickupAddress: '',
    });
    expect('password' in payload).toBe(false);
    expect('apiKey' in payload).toBe(false);
  });

  it('sends typed secrets and numeric origins', () => {
    const payload = buildCourierSettingsPayload(
      draft({ password: SECRET, originDistrictId: '3', originCityId: '17' }),
    );
    expect(payload.password).toBe(SECRET);
    expect(payload.originDistrictId).toBe(3);
    expect(payload.originCityId).toBe(17);
  });
});

describe('resolveCourierSettingsUpdate', () => {
  it('clears stored email, origin and pickup when the form is emptied', () => {
    const { data } = resolveCourierSettingsUpdate(
      {
        env: 'STAGING',
        email: '',
        originDistrictId: null,
        originCityId: null,
        pickupAddress: '',
      },
      {
        email: 'old@example.com',
        originDistrictId: 1,
        originCityId: 2,
        pickupAddress: 'Old address',
      },
    );

    expect(data.email).toBeNull();
    expect(data.originDistrictId).toBeNull();
    expect(data.originCityId).toBeNull();
    expect(data.pickupAddress).toBeNull();
  });

  it('keeps the saved secret when the password field is left blank', () => {
    const { data, effective } = resolveCourierSettingsUpdate(
      { password: '', apiKey: '' },
      { email: 'old@example.com', password: SECRET, apiKey: null },
    );
    expect('password' in data).toBe(false);
    expect(effective.password).toBe(SECRET);
  });

  it('replaces the saved secret when a new one is typed', () => {
    const next = randomBytes(16).toString('hex');
    const { data } = resolveCourierSettingsUpdate({ password: next }, { password: SECRET });
    expect(data.password).toBe(next);
  });
});

describe('validateCourierActivation', () => {
  const complete = {
    isActive: true,
    email: 'operator@example.com',
    password: SECRET,
    apiKey: null,
    originDistrictId: 1,
    originCityId: 2,
    pickupAddress: 'Warehouse',
  };

  it('allows an inactive draft to be partial', () => {
    expect(validateCourierActivation({ ...complete, isActive: false })).toEqual([]);
  });

  it('accepts an API key without a password', () => {
    expect(
      validateCourierActivation({ ...complete, password: null, apiKey: SECRET }),
    ).toEqual([]);
  });

  it('requires credentials, origin district, city and pickup when activating', () => {
    const issues = validateCourierActivation({
      isActive: true,
      email: '',
      password: '',
      apiKey: '',
      originDistrictId: null,
      originCityId: null,
      pickupAddress: '  ',
    });
    expect(issues.map((issue) => issue.field)).toEqual([
      'password',
      'originDistrictId',
      'originCityId',
      'pickupAddress',
    ]);
  });
});

describe('resolveCourierTestCredentials', () => {
  it('uses the unsaved form values first and falls back to saved secrets', () => {
    const credentials = resolveCourierTestCredentials(
      { env: 'PRODUCTION', email: 'new@example.com', password: '' },
      { env: 'STAGING', email: 'old@example.com', password: SECRET, apiKey: null },
    );
    expect(credentials).toEqual({
      env: 'PRODUCTION',
      email: 'new@example.com',
      password: SECRET,
    });
    expect(hasCourierTestCredentials(credentials)).toBe(true);
  });

  it('reports missing credentials instead of testing a blank account', () => {
    const credentials = resolveCourierTestCredentials({}, null);
    expect(hasCourierTestCredentials(credentials)).toBe(false);
  });
});
