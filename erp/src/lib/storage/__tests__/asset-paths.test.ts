import { describe, expect, it } from 'vitest';

import { extractTenantAssetPath } from '@/lib/storage/asset-paths';

/** ARGUS #496: deletion must be scoped to the caller's tenant prefix. */
describe('extractTenantAssetPath', () => {
  const tenant = 'tenant-abc';

  it('accepts an R2 public URL with the tenant key at the root', () => {
    expect(
      extractTenantAssetPath(`https://pub-1.r2.dev/${tenant}/website/images/a.png`, tenant),
    ).toBe(`${tenant}/website/images/a.png`);
  });

  it('accepts a bare storage key', () => {
    expect(extractTenantAssetPath(`${tenant}/website/videos/a.mp4`, tenant)).toBe(
      `${tenant}/website/videos/a.mp4`,
    );
  });

  it('accepts Supabase bucket URLs', () => {
    expect(
      extractTenantAssetPath(
        `https://x.supabase.co/storage/v1/object/public/product-images/${tenant}/website/images/a.png`,
        tenant,
      ),
    ).toBe(`${tenant}/website/images/a.png`);
  });

  it('accepts Cloudinary website-folder URLs', () => {
    expect(
      extractTenantAssetPath(
        `https://res.cloudinary.com/demo/image/upload/v1/website-images/${tenant}/website/images/a.webp`,
        tenant,
      ),
    ).toBe(`${tenant}/website/images/a.webp`);
  });

  it('rejects another tenant path', () => {
    expect(extractTenantAssetPath('tenant-other/website/images/a.png', tenant)).toBeNull();
  });

  it('rejects a tenant id nested under an unknown folder', () => {
    expect(extractTenantAssetPath(`other/${tenant}/website/images/a.png`, tenant)).toBeNull();
  });

  it('rejects traversal and encoded traversal', () => {
    expect(extractTenantAssetPath(`${tenant}/../tenant-other/x.png`, tenant)).toBeNull();
    expect(extractTenantAssetPath(`${tenant}/%2e%2e/tenant-other/x.png`, tenant)).toBeNull();
  });

  it('rejects empty input', () => {
    expect(extractTenantAssetPath('', tenant)).toBeNull();
    expect(extractTenantAssetPath(`${tenant}/x`, '')).toBeNull();
  });
});
