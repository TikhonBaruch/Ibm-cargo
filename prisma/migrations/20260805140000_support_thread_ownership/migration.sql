-- Support thread ownership + CalculationEvent actor FK

ALTER TABLE "chat_threads" ADD COLUMN IF NOT EXISTS "companyId" TEXT;
ALTER TABLE "chat_threads" ADD COLUMN IF NOT EXISTS "createdByUserId" TEXT;

CREATE INDEX IF NOT EXISTS "chat_threads_companyId_idx" ON "chat_threads"("companyId");
CREATE INDEX IF NOT EXISTS "chat_threads_createdByUserId_idx" ON "chat_threads"("createdByUserId");

DO $$ BEGIN
  ALTER TABLE "chat_threads"
    ADD CONSTRAINT "chat_threads_companyId_fkey"
    FOREIGN KEY ("companyId") REFERENCES "companies"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "chat_threads"
    ADD CONSTRAINT "chat_threads_createdByUserId_fkey"
    FOREIGN KEY ("createdByUserId") REFERENCES "users"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS "calculation_events_actorUserId_idx" ON "calculation_events"("actorUserId");

DO $$ BEGIN
  ALTER TABLE "calculation_events"
    ADD CONSTRAINT "calculation_events_actorUserId_fkey"
    FOREIGN KEY ("actorUserId") REFERENCES "users"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
