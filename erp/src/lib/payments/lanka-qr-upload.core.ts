/**
 * LankaQR static-image upload contract (ARGUS #516).
 *
 * The Payments page says "paste or upload it here" but only offered a URL
 * input. Uploads now go through a tenant-scoped endpoint; these pure rules are
 * shared by the route (authoritative) and the form (early feedback) so a user
 * sees the same message before and after the request.
 */

export const LANKA_QR_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const;
export const LANKA_QR_IMAGE_MAX_BYTES = 2 * 1024 * 1024;

export const LANKA_QR_IMAGE_ACCEPT = LANKA_QR_IMAGE_TYPES.join(',');

export const LANKA_QR_UPLOAD_ERRORS = {
  type: 'Only JPEG, PNG and WebP images are accepted for the QR image.',
  size: 'QR image must be under 2 MB.',
} as const;

/** Returns the rejection message, or null when the file is acceptable. */
export function lankaQrUploadError(file: { type: string; size: number }): string | null {
  if (!(LANKA_QR_IMAGE_TYPES as readonly string[]).includes(file.type)) {
    return LANKA_QR_UPLOAD_ERRORS.type;
  }
  if (file.size > LANKA_QR_IMAGE_MAX_BYTES) {
    return LANKA_QR_UPLOAD_ERRORS.size;
  }
  return null;
}
