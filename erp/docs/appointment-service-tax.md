# Appointment service tax

Appointment services had no tax rule; conversions applied the tenant VAT
unconditionally (or zero when unset) with no documented exemption, so a
Rs. 2,500 treatment could appear without a VAT breakdown or an explicit exempt
basis (ARGUS #131).

## Model

`AppointmentService.taxRule` (`TaxRule`, default `STANDARD_VAT`), migration
`20261121180000_appointment_service_tax`.

## Behaviour

- The service form has a **Tax rule** selector (Standard VAT / SSCL / VAT Exempt)
  and explains that exempt services record zero tax explicitly.
- Conversion (`convertAppointmentToSale`) reads the service's rule and prices the
  sale line with:
  - `STANDARD_VAT` -> tenant `vatRate`
  - `SSCL` -> tenant `ssclRate`
  - `EXEMPT` -> 0
  The persisted sale still carries `subtotal`, `taxAmount` and `totalAmount`, and
  the deposit/balance split is unchanged.
- Existing services migrated with the default `STANDARD_VAT`; an operator can
  mark genuinely exempt services in the catalogue.

## Verification

`appointmentSale.core.test.ts` covers VAT, SSCL and exempt, plus the existing
deposit/rounding cases.
