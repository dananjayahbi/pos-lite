-- Store credit is a tender: a sale can be settled (fully or partly) from the
-- customer's credit balance, so the persisted payment legs must be able to
-- carry that value instead of recording the full total as cash/card.
ALTER TYPE "PaymentLegMethod" ADD VALUE IF NOT EXISTS 'STORE_CREDIT';
ALTER TYPE "PaymentMethod" ADD VALUE IF NOT EXISTS 'STORE_CREDIT';
