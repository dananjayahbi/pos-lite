import { readFileSync } from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import { TAX_RULE_OPTIONS } from '@/lib/constants/product-options';

/**
 * ARGUS #470: product create, edit and detail must derive the tax-rule label
 * from the configured rate, never a hard-coded percentage. The pure
 * `taxRuleLabel` tests pin the formatting; this guard pins the wiring on each
 * product surface so a future form cannot quietly reintroduce "15%".
 */

function readSource(relativePath: string): string {
  return readFileSync(path.join(process.cwd(), relativePath), 'utf8');
}

const PRODUCT_SURFACES = [
  'src/components/wizard/WizardStep1BasicInfo.tsx',
  'src/components/wizard/WizardStep3Review.tsx',
  'src/components/product/ProductDetailClient.tsx',
  'src/components/product/ProductDetailsCard.tsx',
];

describe('product tax-label surfaces', () => {
  it.each(PRODUCT_SURFACES)('%s uses the shared taxRuleLabel helper', (file) => {
    const source = readSource(file);
    expect(source).toContain('taxRuleLabel(');
  });

  it.each(PRODUCT_SURFACES)('%s has no hard-coded rule percentage', (file) => {
    const source = readSource(file);
    expect(source).not.toMatch(/Standard VAT \(\d+(?:\.\d+)?%\)/);
    expect(source).not.toMatch(/SSCL \(\d+(?:\.\d+)?%\)/);
  });

  it('the create review step no longer prints the raw enum', () => {
    const source = readSource('src/components/wizard/WizardStep3Review.tsx');
    expect(source).not.toMatch(/taxRule\.replace\(\/_\/g/);
  });

  it('the selector options carry neutral labels, not a percentage', () => {
    for (const option of TAX_RULE_OPTIONS) {
      expect(option.label).not.toMatch(/%/);
    }
  });
});
