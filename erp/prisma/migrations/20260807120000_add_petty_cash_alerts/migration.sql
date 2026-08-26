-- Session 19 — Petty Cash Low-Balance Alerts (doc 40)
-- Adds a first-class notification type and suppression state on the fund.

ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'PETTY_CASH_LOW';

ALTER TABLE "petty_cash_funds"
  ADD COLUMN "lowBalanceAlerted" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "lastLowAlertAt" TIMESTAMP(3);
