import { describe, expect, it } from 'vitest';

import {
  canPrintWaybill,
  labelTemplateErrorMessage,
  resolveLabelTemplate,
  resolveLabelTemplateViewState,
  type LabelTemplateViewInput,
} from '@/components/delivery/labels/labelTemplateState';

/**
 * ARGUS #298 — a failed template read must never look like a blank template,
 * and an empty sender must fall back to tenant branding.
 */
function input(overrides: Partial<LabelTemplateViewInput> = {}): LabelTemplateViewInput {
  return { isError: false, isLoading: false, hasTemplate: false, ...overrides };
}

describe('resolveLabelTemplateViewState', () => {
  it('reports an error before anything else', () => {
    expect(resolveLabelTemplateViewState(input({ isError: true }))).toBe('error');
    expect(resolveLabelTemplateViewState(input({ isError: true, isLoading: true }))).toBe('error');
    expect(
      resolveLabelTemplateViewState(input({ isError: true, hasTemplate: true })),
    ).toBe('error');
  });

  it('shows loading before missing', () => {
    expect(resolveLabelTemplateViewState(input({ isLoading: true }))).toBe('loading');
  });

  it('distinguishes a missing template from a failed request', () => {
    expect(resolveLabelTemplateViewState(input())).toBe('missing');
  });

  it('is ready only when the template object loaded', () => {
    expect(resolveLabelTemplateViewState(input({ hasTemplate: true }))).toBe('ready');
  });
});

describe('canPrintWaybill', () => {
  const resolved = { brandName: 'Dilani Ayurveda', fromContact: '076 199 2828' };

  it('blocks print while loading, on error, when no template loaded or with no sender', () => {
    expect(canPrintWaybill('error', resolved)).toBe(false);
    expect(canPrintWaybill('loading', resolved)).toBe(false);
    expect(canPrintWaybill('missing', resolved)).toBe(false);
    expect(canPrintWaybill('ready', { brandName: '   ', fromContact: '076' })).toBe(false);
    expect(canPrintWaybill('ready', { brandName: 'Store', fromContact: '   ' })).toBe(false);
    expect(canPrintWaybill('ready', null)).toBe(false);
  });

  it('allows print only for a loaded template with a sender name and contact', () => {
    expect(canPrintWaybill('ready', resolved)).toBe(true);
  });
});

describe('resolveLabelTemplate', () => {
  it('uses the audited business profile instead of a stale saved sender (ARGUS #301)', () => {
    expect(
      resolveLabelTemplate(
        { brandName: '  Ayur Wellness Centre  ', fromContact: ' 0713617236 ' },
        {
          name: 'Ruhunu Weda Gedara',
          address: '12 Temple Road, Matara',
          phoneNumber: '077 111 2222',
        },
      ),
    ).toEqual({
      brandName: 'Ruhunu Weda Gedara',
      fromContact: '077 111 2222',
      pickupAddress: '12 Temple Road, Matara',
    });
  });

  it('falls back to the saved values only when no business branding is supplied', () => {
    expect(
      resolveLabelTemplate(
        { brandName: '  DILANI  ', fromContact: ' 076 199 2828 ' },
        undefined,
      ),
    ).toEqual({ brandName: 'DILANI', fromContact: '076 199 2828', pickupAddress: '' });
  });

  it('shows the Store Profile branding in the preview when the saved sender is blank (ARGUS #304)', () => {
    // The designer's live preview and the print path both call this helper, so
    // a blank saved template must resolve to the same non-empty sender.
    const preview = resolveLabelTemplate(
      { brandName: '', fromContact: '', pickupAddress: '' },
      {
        name: 'Ruhunu Weda Gedara',
        address: '12 Temple Road, Matara',
        phoneNumber: '077 111 2222',
      },
    );
    expect(preview).toEqual({
      brandName: 'Ruhunu Weda Gedara',
      fromContact: '077 111 2222',
      pickupAddress: '12 Temple Road, Matara',
    });
    expect(
      canPrintWaybill('ready', { brandName: preview.brandName, fromContact: preview.fromContact }),
    ).toBe(true);
  });

  it('does not invent missing business fields', () => {
    expect(resolveLabelTemplate(null, { name: 'Store' })).toEqual({
      brandName: 'Store',
      fromContact: '',
      pickupAddress: '',
    });
  });

  it('returns empty strings when neither source has data', () => {
    expect(resolveLabelTemplate(undefined, undefined)).toEqual({
      brandName: '',
      fromContact: '',
      pickupAddress: '',
    });
  });
});

describe('labelTemplateErrorMessage', () => {
  it('surfaces the endpoint message', () => {
    expect(labelTemplateErrorMessage(new Error('Template load failed'), 'fallback')).toBe(
      'Template load failed',
    );
  });

  it('falls back for an empty message', () => {
    expect(labelTemplateErrorMessage(new Error('   '), 'fallback')).toBe('fallback');
    expect(labelTemplateErrorMessage(undefined, 'fallback')).toBe('fallback');
  });
});
