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
  const resolved = { brandName: 'Dilani Ayurveda' };

  it('blocks print while loading, on error, when no template loaded or with no sender', () => {
    expect(canPrintWaybill('error', resolved)).toBe(false);
    expect(canPrintWaybill('loading', resolved)).toBe(false);
    expect(canPrintWaybill('missing', resolved)).toBe(false);
    expect(canPrintWaybill('ready', { brandName: '   ' })).toBe(false);
    expect(canPrintWaybill('ready', null)).toBe(false);
  });

  it('allows print only for a loaded template with a sender identity', () => {
    expect(canPrintWaybill('ready', resolved)).toBe(true);
  });
});

describe('resolveLabelTemplate', () => {
  it('uses explicit sender values when present', () => {
    expect(
      resolveLabelTemplate(
        { brandName: '  DILANI  ', fromContact: ' 076 199 2828 ' },
        { name: 'Store', phoneNumber: '011 111 1111' },
      ),
    ).toEqual({ brandName: 'DILANI', fromContact: '076 199 2828' });
  });

  it('falls back to tenant brand name and contact for an empty template', () => {
    expect(
      resolveLabelTemplate(
        { brandName: '', fromContact: '' },
        { name: 'Dilani Ayurveda', address: 'Colombo', phoneNumber: '076 199 2828' },
      ),
    ).toEqual({ brandName: 'Dilani Ayurveda', fromContact: '076 199 2828' });
  });

  it('never renders a dash placeholder when branding exists', () => {
    const resolved = resolveLabelTemplate(null, { name: 'Store', phoneNumber: '077' });
    expect(resolved.brandName).toBe('Store');
    expect(resolved.fromContact).toBe('077');
  });

  it('returns empty strings when neither source has data', () => {
    expect(resolveLabelTemplate(undefined, undefined)).toEqual({
      brandName: '',
      fromContact: '',
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
