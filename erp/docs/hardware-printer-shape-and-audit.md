# Hardware printer settings: both stored shapes, audited writes

The live tenant stored the printer flat (`settings.hardware.{type,host,port}`,
as the seed writes it) while `/settings/hardware` only read the nested
`settings.hardware.printer.*` shape. The page showed a blank IP and a default
port, and because the network host looked empty, Save stayed disabled (ARGUS
#510).

## Behaviour

- `readHardwareSettings` (`src/lib/settings/hardwareSettings.core.ts`) reads the
  nested shape first, then the flat shape, with type `NETWORK`, port `9100` and
  switches off as defaults. The page and the PATCH route share it.
- PATCH is fully partial: an omitted field keeps the stored value, so flipping
  the cash drawer no longer requires retyping the host.
- The host is required only when the EFFECTIVE printer type is `NETWORK`; a
  `USB` printer may keep a blank host.
- The route writes nested `hardware.printer.{type,host,port}` as canonical and
  mirrors the same three fields at the flat level for legacy readers.
- The tenant update and an `AuditLog` row (`SETTINGS_CHANGED`, entity
  `TenantSettings`) commit in one transaction. The audit snapshot contains only
  the five hardware fields, never unrelated settings or credentials.

## Verification

`src/lib/settings/__tests__/hardwareSettings.core.test.ts` covers nested, flat,
mixed and default shapes, partial merges, the NETWORK-only host rule and the
audit snapshot shape.
