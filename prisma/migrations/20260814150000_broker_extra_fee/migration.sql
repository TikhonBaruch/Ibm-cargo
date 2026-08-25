-- Broker extra fees (F2): not TariffPlan.priceRub; note required in domain when > 0
ALTER TABLE "calculations"
  ADD COLUMN "extraFeeRub" INTEGER,
  ADD COLUMN "extraFeeNote" TEXT;
