import { describe, expect, it } from 'vitest';

import {
  BARCODE_LABEL_FIELD_LABELS,
  BARCODE_LABEL_TEMPLATES,
  barcodeLabelFields,
  barcodeLabelHasField,
  barcodeLabelSize,
  barcodeLabelTemplateSummary,
  getBarcodeLabelTemplate,
} from '@/lib/barcode-label-templates.core';
import { BARCODE_LABELS_PER_SHEET } from '@/lib/barcode-sheet.core';

/**
 * ARGUS #157: the Barcode Printing page and the inventory Print Labels dialog
 * used to describe two different, undocumented label formats. Both now read
 * these shared definitions, so a template always has one size and field set.
 */
describe('barcode label templates', () => {
  it('defines exactly the two operator-facing templates', () => {
    expect(BARCODE_LABEL_TEMPLATES.map((template) => template.id)).toEqual([
      'a4-24up',
      'thermal-4x6',
    ]);
  });

  it('keeps the A4 template on the shared 24-up sheet grid', () => {
    const a4 = getBarcodeLabelTemplate('a4-24up');

    expect(a4.continuousRoll).toBe(false);
    expect(a4.columns).toBe(3);
    expect(a4.rows).toBe(8);
    expect(a4.labelsPerPage).toBe(24);
    expect(a4.labelsPerPage).toBe(BARCODE_LABELS_PER_SHEET);
    expect(a4.sheet).toEqual({ widthMm: 210, heightMm: 297, marginMm: 5 });
    expect(barcodeLabelSize(a4)).toBe('63.5 x 33.9 mm');
  });

  it('defines the thermal roll as one 40 x 60 mm label per feed', () => {
    const thermal = getBarcodeLabelTemplate('thermal-4x6');

    expect(thermal.continuousRoll).toBe(true);
    expect(thermal.labelsPerPage).toBeNull();
    expect(thermal.sheet).toBeNull();
    expect(barcodeLabelSize(thermal)).toBe('40 x 60 mm');
  });

  it('documents the field set per template', () => {
    const a4 = getBarcodeLabelTemplate('a4-24up');
    const thermal = getBarcodeLabelTemplate('thermal-4x6');

    // The compact A4 label has no room for the brand or the stock dot.
    expect(barcodeLabelHasField(a4, 'brand')).toBe(false);
    expect(barcodeLabelHasField(a4, 'lowStockDot')).toBe(false);
    expect(barcodeLabelHasField(a4, 'productName')).toBe(true);
    expect(barcodeLabelHasField(a4, 'barcode')).toBe(true);
    expect(barcodeLabelHasField(a4, 'price')).toBe(true);

    expect(barcodeLabelHasField(thermal, 'brand')).toBe(true);
    expect(barcodeLabelHasField(thermal, 'lowStockDot')).toBe(true);
    expect(barcodeLabelFields(thermal)).toContain('Low-stock dot');
    expect(barcodeLabelFields(thermal)).toContain('Brand');
  });

  it('summarises size, layout and fields in one line', () => {
    expect(barcodeLabelTemplateSummary(getBarcodeLabelTemplate('a4-24up'))).toContain(
      '24 labels per A4 sheet (3 x 8)',
    );
    expect(barcodeLabelTemplateSummary(getBarcodeLabelTemplate('thermal-4x6'))).toContain(
      'continuous roll, one label per feed',
    );
  });

  it('has a label for every declared field and rejects unknown templates', () => {
    for (const template of BARCODE_LABEL_TEMPLATES) {
      for (const field of template.fields) {
        expect(BARCODE_LABEL_FIELD_LABELS[field]).toBeTruthy();
      }
    }

    expect(() =>
      getBarcodeLabelTemplate('unknown' as 'a4-24up'),
    ).toThrow('Unknown barcode label template');
  });
});
