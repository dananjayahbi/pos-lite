-- Appointment (service) sales have no product variant: services are sold as a
-- snapshot line, carry no stock and cannot be restocked by a return.
ALTER TABLE "sale_lines" ALTER COLUMN "variantId" DROP NOT NULL;
