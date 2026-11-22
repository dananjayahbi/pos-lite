# Website CMS - link and colour validation

ARGUS #503: navigation, footer, CTA, announcement and ad-target fields accepted
any string up to the length limit, including `javascript:...` and a bare `#`
(the "Add Item" default). The storefront renders these values directly. The
colour text inputs accepted any 7-character value.

## Rules

`src/lib/website/link-validation.core.ts` defines one shared contract:

- allow `/path`, `#named-section`, `mailto:`, `tel:` and absolute `http(s)`;
- reject a bare `#`, relative words, protocol-relative `//host`, whitespace /
  control characters and every other scheme (`javascript:`, `data:`, ...);
- empty stays valid for optional fields (clears the link);
- colours must be `#rgb` or `#rrggbb`; empty means "use the saved default".

`src/lib/validators/website.validators.ts` applies this to nav items (including
children), hero CTA links, footer links, announcement links, ad `targetUrl`,
hero consult links, slider links, info-ad button links and the five colour
fields. Invalid input is a 400 `VALIDATION_ERROR` naming the field.

On the client, nav/footer/CTA inputs set `aria-invalid` and the General tab
shows the hex hint. Save-time errors still surface the server's field message.

## Verification

- `npx tsc --noEmit`
- `npx vitest run src/lib/website/__tests__/link-validation.core.test.ts src/lib/validators/__tests__/website.validators.test.ts`
