-- D24: product description attrs, TN VED directory, calculation event history

-- CreateEnum
CREATE TYPE "CalculationEventKind" AS ENUM (
  'CREATED',
  'AI_DRAFT',
  'STATUS',
  'PAID',
  'CLAIMED',
  'ITEM_MAPPED',
  'APPROVED',
  'NOTE'
);

-- AlterTable CalculationItem
ALTER TABLE "calculation_items" ADD COLUMN "attrs" JSONB;
ALTER TABLE "calculation_items" ADD COLUMN "tnvedCode" TEXT;

CREATE INDEX "calculation_items_tnvedCode_idx" ON "calculation_items"("tnvedCode");

-- CreateTable CalculationEvent
CREATE TABLE "calculation_events" (
    "id" TEXT NOT NULL,
    "calculationId" TEXT NOT NULL,
    "kind" "CalculationEventKind" NOT NULL,
    "actorUserId" TEXT,
    "payload" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "calculation_events_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "calculation_events_calculationId_createdAt_idx" ON "calculation_events"("calculationId", "createdAt");
CREATE INDEX "calculation_events_kind_idx" ON "calculation_events"("kind");
CREATE INDEX "calculation_events_createdAt_idx" ON "calculation_events"("createdAt");

ALTER TABLE "calculation_events"
  ADD CONSTRAINT "calculation_events_calculationId_fkey"
  FOREIGN KEY ("calculationId") REFERENCES "calculations"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateTable TnvedCode
CREATE TABLE "tnved_codes" (
    "code" TEXT NOT NULL,
    "codeDisplay" TEXT NOT NULL,
    "level" INTEGER NOT NULL,
    "parentCode" TEXT,
    "titleRu" TEXT NOT NULL,
    "titleEn" TEXT,
    "isLeaf" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "notes" TEXT,
    "validFrom" TIMESTAMP(3),
    "validTo" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tnved_codes_pkey" PRIMARY KEY ("code")
);

CREATE INDEX "tnved_codes_parentCode_idx" ON "tnved_codes"("parentCode");
CREATE INDEX "tnved_codes_level_idx" ON "tnved_codes"("level");
CREATE INDEX "tnved_codes_isActive_idx" ON "tnved_codes"("isActive");
CREATE INDEX "tnved_codes_codeDisplay_idx" ON "tnved_codes"("codeDisplay");

ALTER TABLE "tnved_codes"
  ADD CONSTRAINT "tnved_codes_parentCode_fkey"
  FOREIGN KEY ("parentCode") REFERENCES "tnved_codes"("code")
  ON DELETE RESTRICT ON UPDATE CASCADE;

-- CreateTable TnvedDutyRate
CREATE TABLE "tnved_duty_rates" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "dutyKind" TEXT NOT NULL DEFAULT 'AD_VALOREM',
    "dutyPct" DOUBLE PRECISION,
    "dutyRubPerUnit" DOUBLE PRECISION,
    "vatPct" DOUBLE PRECISION DEFAULT 20,
    "feeHintRub" INTEGER,
    "unit" TEXT,
    "validFrom" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "validTo" TIMESTAMP(3),
    "source" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tnved_duty_rates_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "tnved_duty_rates_code_idx" ON "tnved_duty_rates"("code");
CREATE INDEX "tnved_duty_rates_validFrom_validTo_idx" ON "tnved_duty_rates"("validFrom", "validTo");

ALTER TABLE "tnved_duty_rates"
  ADD CONSTRAINT "tnved_duty_rates_code_fkey"
  FOREIGN KEY ("code") REFERENCES "tnved_codes"("code")
  ON DELETE CASCADE ON UPDATE CASCADE;
