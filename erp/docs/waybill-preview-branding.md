# Waybill preview shows the branding that prints

The designer used to say "Leave the sender name blank to use your store
branding", but the live preview and the sample print rendered `From: -` until a
server-side fallback ran on save (ARGUS #304). The preview therefore looked
broken while the printed label would have used the business name.

## Behaviour

- The sender is the audited Store Profile (ARGUS #301): business name, phone and
  pickup address. The sender fields are read-only, so a blank saved value cannot
  be typed back in.
- The designer preview, the sample print and every real print call
  `resolveLabelTemplate()` with the same template + branding pair, so the
  `From` and `Contact` rows are identical in all three.
- When the Store Profile has no name/phone, the preview honestly shows `-` and
  `canPrintWaybill()` blocks printing instead of printing an anonymous label.

## Verification

`labelTemplateState.test.ts` pins that a blank saved template resolves to the
Store Profile branding and is printable once those fields exist.
