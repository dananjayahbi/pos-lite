-- PayHere card payments for website orders.
--
-- 1. `shipping_addresses.email` — PayHere requires a VALID email and phone on
--    the checkout form (an invalid one is rejected, and HelaPay payments hard
--    fail without valid contact details). The checkout now collects the
--    customer's email alongside the address. Nullable: ERP-entered deliveries
--    and existing rows have no email.
--
-- 2. `deliveries.payherePaymentId` / `deliveries.payhereMethod` — PayHere's own
--    unique payment id and the method the customer actually used
--    (VISA/MASTER/GENIE/EZCASH/…). Both arrive on the IPN and are displayed on
--    the order; `payhereOrderId` (our checkout `order_id`) already exists.
--
--    Note the camelCase column names: this table's pre-existing PayHere column
--    (`payhereOrderId`, added by 20260807030000_add_order_payment_fields) has no
--    `@map`, so Prisma addresses these fields by their model names. Creating
--    them snake_case makes every write fail with P2022 while the Prisma client
--    believes it is valid.

ALTER TABLE "shipping_addresses" ADD COLUMN "email" TEXT;

ALTER TABLE "deliveries" ADD COLUMN "payherePaymentId" TEXT;
ALTER TABLE "deliveries" ADD COLUMN "payhereMethod" TEXT;
