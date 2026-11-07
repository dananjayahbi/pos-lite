-- Marketing broadcasts now support Email and SMS in addition to the legacy
-- WhatsApp channel. Email rows store a subject, HTML body and attached image
-- URLs; SMS rows leave those null/empty.
CREATE TYPE "BroadcastChannel" AS ENUM ('EMAIL', 'SMS', 'WHATSAPP');

ALTER TABLE "customer_broadcasts"
  ADD COLUMN "channel" "BroadcastChannel" NOT NULL DEFAULT 'EMAIL',
  ADD COLUMN "subject" TEXT,
  ADD COLUMN "htmlBody" TEXT,
  ADD COLUMN "imageUrls" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
