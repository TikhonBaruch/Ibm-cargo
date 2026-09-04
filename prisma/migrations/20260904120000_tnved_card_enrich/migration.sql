-- Card-enrich overlay (plan-tnved-card-enrich.md)
CREATE TABLE IF NOT EXISTS "tnved_enrich_snapshots" (
    "id" TEXT NOT NULL,
    "sourceKey" TEXT NOT NULL,
    "sourceSha" TEXT NOT NULL,
    "asOf" TIMESTAMP(3),
    "schemaKind" TEXT NOT NULL DEFAULT 'card-enrich/v1',
    "rowCount" INTEGER NOT NULL DEFAULT 0,
    "uniqueCodes" INTEGER NOT NULL DEFAULT 0,
    "isCurrent" BOOLEAN NOT NULL DEFAULT false,
    "loadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "tnved_enrich_snapshots_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "tnved_enrich_snapshots_sourceKey_key" ON "tnved_enrich_snapshots"("sourceKey");
CREATE INDEX IF NOT EXISTS "tnved_enrich_snapshots_isCurrent_idx" ON "tnved_enrich_snapshots"("isCurrent");
CREATE INDEX IF NOT EXISTS "tnved_enrich_snapshots_asOf_idx" ON "tnved_enrich_snapshots"("asOf");

CREATE TABLE IF NOT EXISTS "tnved_enrich_facts" (
    "id" TEXT NOT NULL,
    "snapshotId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "fieldKind" TEXT NOT NULL,
    "valueShort" TEXT,
    "valueText" TEXT,
    "npaRef" TEXT,
    "sourceLayer" TEXT,
    "asOf" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "tnved_enrich_facts_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "tnved_enrich_facts_snapshotId_idx" ON "tnved_enrich_facts"("snapshotId");
CREATE INDEX IF NOT EXISTS "tnved_enrich_facts_code_idx" ON "tnved_enrich_facts"("code");
CREATE INDEX IF NOT EXISTS "tnved_enrich_facts_fieldKind_idx" ON "tnved_enrich_facts"("fieldKind");
CREATE INDEX IF NOT EXISTS "tnved_enrich_facts_snapshotId_code_idx" ON "tnved_enrich_facts"("snapshotId", "code");

DO $$ BEGIN
  ALTER TABLE "tnved_enrich_facts"
    ADD CONSTRAINT "tnved_enrich_facts_snapshotId_fkey"
    FOREIGN KEY ("snapshotId") REFERENCES "tnved_enrich_snapshots"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
