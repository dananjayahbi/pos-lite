import { describe, expect, it } from 'vitest';

import { PERMISSIONS } from '@/lib/constants/permissions';
import {
  SETTINGS_CATALOG,
  visibleSettingsCatalog,
} from '@/lib/settings/settings-catalog';

/** ARGUS #484: the hub must mirror the sidebar's Settings group. */
describe('settings hub catalog', () => {
  it('lists Units at /settings/units', () => {
    const units = SETTINGS_CATALOG.find((entry) => entry.href === '/settings/units');
    expect(units).toBeDefined();
    expect(units?.label).toBe('Units');
  });

  it('shows Units only to users who can view raw materials', () => {
    const withUnits = visibleSettingsCatalog([
      PERMISSIONS.RAW_MATERIAL.viewRawMaterial,
    ]);
    expect(withUnits.some((entry) => entry.href === '/settings/units')).toBe(true);

    const withoutUnits = visibleSettingsCatalog([]);
    expect(withoutUnits.some((entry) => entry.href === '/settings/units')).toBe(
      false,
    );
  });

  it('keeps every hub href unique', () => {
    const hrefs = SETTINGS_CATALOG.map((entry) => entry.href);
    expect(new Set(hrefs).size).toBe(hrefs.length);
  });
});
