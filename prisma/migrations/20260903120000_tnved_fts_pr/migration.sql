-- AlterTable: FTS preliminary decisions overlay (FTS-PR)
CREATE TABLE IF NOT EXISTS "tnved_fts_snapshots" (
    "id" TEXT NOT NULL,
    "sourceFile" TEXT NOT NULL,
    "sourceSha" TEXT NOT NULL,
    "asOf" TIMESTAMP(3),
    "schemaKind" TEXT NOT NULL DEFAULT 'canon4',
    "rowCount" INTEGER NOT NULL DEFAULT 0,
    "uniqueCodes" INTEGER NOT NULL DEFAULT 0,
    "isCurrent" BOOLEAN NOT NULL DEFAULT false,
    "loadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "tnved_fts_snapshots_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "tnved_fts_snapshots_sourceSha_key" ON "tnved_fts_snapshots"("sourceSha");
CREATE INDEX IF NOT EXISTS "tnved_fts_snapshots_isCurrent_idx" ON "tnved_fts_snapshots"("isCurrent");
CREATE INDEX IF NOT EXISTS "tnved_fts_snapshots_asOf_idx" ON "tnved_fts_snapshots"("asOf");

CREATE TABLE IF NOT EXISTS "tnved_fts_decisions" (
    "id" TEXT NOT NULL,
    "snapshotId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "country" TEXT,
    "justification" TEXT,
    "descFingerprint" TEXT NOT NULL,
    "rowIndex" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "tnved_fts_decisions_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "tnved_fts_decisions_snapshotId_idx" ON "tnved_fts_decisions"("snapshotId");
CREATE INDEX IF NOT EXISTS "tnved_fts_decisions_code_idx" ON "tnved_fts_decisions"("code");
CREATE INDEX IF NOT EXISTS "tnved_fts_decisions_descFingerprint_idx" ON "tnved_fts_decisions"("descFingerprint");

DO $$ BEGIN
  ALTER TABLE "tnved_fts_decisions"
    ADD CONSTRAINT "tnved_fts_decisions_snapshotId_fkey"
    FOREIGN KEY ("snapshotId") REFERENCES "tnved_fts_snapshots"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
