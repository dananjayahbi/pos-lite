import { describe, expect, it } from 'vitest';

import {
  LANKA_QR_IMAGE_MAX_BYTES,
  LANKA_QR_UPLOAD_ERRORS,
  lankaQrUploadError,
} from '@/lib/payments/lanka-qr-upload.core';

/**
 * ARGUS #516: the page promised "paste or upload" but had no file control.
 * The upload path accepts the same raster formats as the logo uploader.
 */
describe('lankaQrUploadError', () => {
  it('accepts JPEG, PNG and WebP under 2 MB', () => {
    for (const type of ['image/jpeg', 'image/png', 'image/webp']) {
      expect(lankaQrUploadError({ type, size: 1024 })).toBeNull();
    }
  });

  it('rejects SVG and non-image files', () => {
    expect(lankaQrUploadError({ type: 'image/svg+xml', size: 1024 })).toBe(
      LANKA_QR_UPLOAD_ERRORS.type,
    );
    expect(lankaQrUploadError({ type: 'application/pdf', size: 1024 })).toBe(
      LANKA_QR_UPLOAD_ERRORS.type,
    );
  });

  it('rejects files over the 2 MB cap', () => {
    expect(
      lankaQrUploadError({ type: 'image/png', size: LANKA_QR_IMAGE_MAX_BYTES + 1 }),
    ).toBe(LANKA_QR_UPLOAD_ERRORS.size);
    expect(
      lankaQrUploadError({ type: 'image/png', size: LANKA_QR_IMAGE_MAX_BYTES }),
    ).toBeNull();
  });
});
