-- An EXCHANGE return funds its replacement sale. The credit is a tender leg on
-- the linked sale, distinct from store credit (which lives on the customer).
ALTER TYPE "PaymentLegMethod" ADD VALUE IF NOT EXISTS 'EXCHANGE_CREDIT';
ALTER TYPE "PaymentMethod" ADD VALUE IF NOT EXISTS 'EXCHANGE_CREDIT';
