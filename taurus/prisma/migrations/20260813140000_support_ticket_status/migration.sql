-- SUPPORT ticket lifecycle (not Calculation D8).

DO $$ BEGIN
  CREATE TYPE "SupportTicketStatus" AS ENUM ('OPEN', 'WAITING_CLIENT', 'RESOLVED', 'ARCHIVED');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE "chat_threads" ADD COLUMN IF NOT EXISTS "ticketStatus" "SupportTicketStatus" NOT NULL DEFAULT 'OPEN';
ALTER TABLE "chat_threads" ADD COLUMN IF NOT EXISTS "resolvedAt" TIMESTAMP(3);
ALTER TABLE "chat_threads" ADD COLUMN IF NOT EXISTS "archivedAt" TIMESTAMP(3);

CREATE INDEX IF NOT EXISTS "chat_threads_ticketStatus_idx" ON "chat_threads"("ticketStatus");

UPDATE "chat_threads"
SET "ticketStatus" = 'WAITING_CLIENT'
WHERE "kind" = 'SUPPORT'
  AND "waitingOn" = 'CLIENT'
  AND "ticketStatus" = 'OPEN';
