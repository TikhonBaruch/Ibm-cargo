-- D31 manufacturer partner catalog (invite-only role + SKU master-data)

ALTER TYPE "UserRole" ADD VALUE IF NOT EXISTS 'MANUFACTURER';

CREATE TYPE "CompanyKind" AS ENUM ('CLIENT', 'MANUFACTURER');
CREATE TYPE "ManufacturerSkuStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'ARCHIVED');

ALTER TABLE "companies" ADD COLUMN "kind" "CompanyKind" NOT NULL DEFAULT 'CLIENT';
CREATE INDEX "companies_kind_idx" ON "companies"("kind");

CREATE TABLE "manufacturer_skus" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "sku" TEXT NOT NULL,
    "gtin" TEXT,
    "name" TEXT NOT NULL,
    "customsName" TEXT,
    "brand" TEXT,
    "model" TEXT,
    "variant" TEXT,
    "originCountry" TEXT,
    "factoryName" TEXT,
    "status" "ManufacturerSkuStatus" NOT NULL DEFAULT 'DRAFT',
    "version" INTEGER NOT NULL DEFAULT 1,
    "netWeightKg" DOUBLE PRECISION,
    "grossWeightKg" DOUBLE PRECISION,
    "volumeM3" DOUBLE PRECISION,
    "lengthMm" INTEGER,
    "widthMm" INTEGER,
    "heightMm" INTEGER,
    "description" TEXT,
    "compositionText" TEXT,
    "material" TEXT,
    "purpose" TEXT,
    "technicalSpecs" TEXT,
    "hsHint" TEXT,
    "features" JSONB,
    "packagings" JSONB,
    "moq" INTEGER,
    "packMultiple" INTEGER,
    "incoterms" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "manufacturer_skus_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "manufacturer_skus_companyId_sku_key" ON "manufacturer_skus"("companyId", "sku");
CREATE INDEX "manufacturer_skus_companyId_status_idx" ON "manufacturer_skus"("companyId", "status");

ALTER TABLE "manufacturer_skus" ADD CONSTRAINT "manufacturer_skus_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "calculation_items" ADD COLUMN "manufacturerSkuId" TEXT;
CREATE INDEX "calculation_items_manufacturerSkuId_idx" ON "calculation_items"("manufacturerSkuId");
ALTER TABLE "calculation_items" ADD CONSTRAINT "calculation_items_manufacturerSkuId_fkey" FOREIGN KEY ("manufacturerSkuId") REFERENCES "manufacturer_skus"("id") ON DELETE SET NULL ON UPDATE CASCADE;
