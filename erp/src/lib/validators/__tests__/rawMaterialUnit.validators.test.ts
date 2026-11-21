import { describe, expect, it } from 'vitest';

import {
  CreateRawMaterialUnitSchema,
  UpdateRawMaterialUnitSchema,
} from '@/lib/validators/rawMaterial.validators';

/** ARGUS #486: clearing the Short label must be an explicit, valid request. */
describe('raw-material unit validators', () => {
  it('accepts a create without a short label so the server can derive one', () => {
    expect(CreateRawMaterialUnitSchema.parse({ name: 'Bottles Of 500ml' })).toEqual({
      name: 'Bottles Of 500ml',
    });
  });

  it('accepts null on update as "clear and derive"', () => {
    expect(UpdateRawMaterialUnitSchema.parse({ shortLabel: null })).toEqual({
      shortLabel: null,
    });
  });

  it('rejects an empty short label', () => {
    expect(
      UpdateRawMaterialUnitSchema.safeParse({ shortLabel: '' }).success,
    ).toBe(false);
  });

  it('still accepts a real short label and rejects one over 20 characters', () => {
    expect(
      UpdateRawMaterialUnitSchema.parse({ shortLabel: ' btl ' }).shortLabel,
    ).toBe('btl');
    expect(
      UpdateRawMaterialUnitSchema.safeParse({ shortLabel: 'x'.repeat(21) }).success,
    ).toBe(false);
  });

  it('rejects a unit name with no letters or digits', () => {
    expect(
      CreateRawMaterialUnitSchema.safeParse({ name: '---' }).success,
    ).toBe(false);
  });
});
