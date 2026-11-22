import { describe, expect, it } from 'vitest';
import {
  CreateBomSchema,
  UpdateBomSchema,
} from '@/lib/validators/bom.validators';
import { INGREDIENT_DUPLICATE_MESSAGE } from '@/lib/services/bom.core';

const base = {
  variantId: 'variant-1',
  name: 'Turmeric Capsules',
};

const ingredient = (rawMaterialId: string, quantityPerUnit = '1') => ({
  rawMaterialId,
  quantityPerUnit,
});

describe('BOM ingredient validation - duplicates (ARGUS #249)', () => {
  it('accepts distinct raw materials', () => {
    const parsed = CreateBomSchema.safeParse({
      ...base,
      ingredients: [ingredient('rm-a'), ingredient('rm-b', '2.5')],
    });
    expect(parsed.success).toBe(true);
  });

  it('rejects the same raw material twice on create', () => {
    const parsed = CreateBomSchema.safeParse({
      ...base,
      ingredients: [ingredient('rm-a'), ingredient('rm-a', '2')],
    });
    expect(parsed.success).toBe(false);
    if (!parsed.success) {
      expect(parsed.error.issues.map((i) => i.message)).toContain(
        INGREDIENT_DUPLICATE_MESSAGE,
      );
    }
  });

  it('rejects the same raw material twice on update', () => {
    const parsed = UpdateBomSchema.safeParse({
      ingredients: [ingredient('rm-a'), ingredient('rm-b'), ingredient('rm-a')],
    });
    expect(parsed.success).toBe(false);
    if (!parsed.success) {
      expect(parsed.error.issues.map((i) => i.message)).toContain(
        INGREDIENT_DUPLICATE_MESSAGE,
      );
    }
  });

  it('accepts an update that does not resend ingredients', () => {
    expect(UpdateBomSchema.safeParse({ name: 'Renamed' }).success).toBe(true);
  });
});
