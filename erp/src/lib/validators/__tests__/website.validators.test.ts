import { describe, expect, it } from 'vitest';

import {
  WebsiteAdSchema,
  WebsiteConfigSchema,
  FooterColumnSchema,
  WebsiteNavItemSchema,
  WebsiteSocialLinksSchema,
} from '@/lib/validators/website.validators';

/** ARGUS #503: storefront fields are rendered directly, so validate them. */
describe('website link schemas', () => {
  it('accepts internal paths and named fragments', () => {
    expect(WebsiteNavItemSchema.safeParse({ label: 'Shop', href: '/shop' }).success).toBe(
      true,
    );
    expect(
      WebsiteNavItemSchema.safeParse({ label: 'Contact', href: '#contact' }).success,
    ).toBe(true);
  });

  it('rejects javascript:, protocol-relative and bare # links', () => {
    for (const href of ['javascript:alert(1)', '//evil.example.com', '#']) {
      expect(WebsiteNavItemSchema.safeParse({ label: 'Bad', href }).success, href).toBe(
        false,
      );
    }
  });

  it('validates footer links and ad targets too', () => {
    expect(
      FooterColumnSchema.safeParse({
        title: 'Help',
        links: [{ label: 'Bad', href: 'javascript:void(0)' }],
      }).success,
    ).toBe(false);

    expect(
      WebsiteAdSchema.safeParse({
        name: 'Banner',
        mediaType: 'image',
        mediaUrl: 'https://cdn.example.com/ad.png',
        targetUrl: 'javascript:alert(1)',
        position: 'header',
      }).success,
    ).toBe(false);
  });
});

describe('website colour schema', () => {
  it('accepts hex colours and empty/absent values', () => {
    expect(
      WebsiteConfigSchema.safeParse({ primaryColor: '#0a0a0a', accentColor: '#fff' })
        .success,
    ).toBe(true);
    expect(WebsiteConfigSchema.safeParse({ primaryColor: '' }).success).toBe(true);
  });

  it('rejects non-hex colour text', () => {
    expect(WebsiteConfigSchema.safeParse({ primaryColor: 'red' }).success).toBe(false);
    expect(WebsiteConfigSchema.safeParse({ bodyColor: '#12345' }).success).toBe(false);
  });
});

/** ARGUS #501: YouTube was already in the schema and needs to stay editable. */
describe('youtube social link', () => {
  it('accepts a channel URL and an empty value', () => {
    expect(
      WebsiteSocialLinksSchema.safeParse({ youtube: 'https://youtube.com/@wedagedara' })
        .success,
    ).toBe(true);
    expect(WebsiteSocialLinksSchema.safeParse({ youtube: '' }).success).toBe(true);
  });
});
