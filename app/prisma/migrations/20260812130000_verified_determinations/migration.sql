-- VerifiedDetermination: broker-approved precedents for product HS matching (Growth local).

CREATE TABLE "verified_determinations" (
    "id" TEXT NOT NULL,
    "fingerprint" TEXT NOT NULL,
    "canonicalText" TEXT NOT NULL,
    "attrsSnapshot" JSONB,
    "hsCodeFinal" TEXT NOT NULL,
    "hsCodeDigits" TEXT NOT NULL,
    "dutyRub" INTEGER,
    "vatRub" INTEGER,
    "feeRub" INTEGER,
    "brokerComment" TEXT,
    "sourceCalculationId" TEXT,
    "sourceItemId" TEXT,
    "approvedByUserId" TEXT,
    "quality" TEXT NOT NULL DEFAULT 'BROKER',
    "usageCount" INTEGER NOT NULL DEFAULT 0,
    "approvedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "verified_determinations_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "verified_determinations_fingerprint_idx" ON "verified_determinations"("fingerprint");
CREATE INDEX "verified_determinations_hsCodeDigits_idx" ON "verified_determinations"("hsCodeDigits");
CREATE INDEX "verified_determinations_approvedAt_idx" ON "verified_determinations"("approvedAt");
