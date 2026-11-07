-- Each petty-cash float is backed by one default CASH payment account so the
-- float balance, the account book, and the Expense ledger stay in sync.
ALTER TABLE "petty_cash_funds" ADD COLUMN "paymentAccountId" TEXT;

CREATE UNIQUE INDEX "petty_cash_funds_paymentAccountId_key"
  ON "petty_cash_funds"("paymentAccountId");

ALTER TABLE "petty_cash_funds"
  ADD CONSTRAINT "petty_cash_funds_paymentAccountId_fkey"
  FOREIGN KEY ("paymentAccountId") REFERENCES "payment_accounts"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
