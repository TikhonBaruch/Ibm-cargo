-- D34: client segments + consolidated factory orders (isolated from Calculation D8)

CREATE TYPE "ClientSegment" AS ENUM ('SINGLE', 'RETAIL_SMALL', 'WHOLESALE');
CREATE TYPE "SkuOrderRequestStatus" AS ENUM ('SUBMITTED', 'REJECTED', 'POOLED', 'CANCELLED');
CREATE TYPE "SkuOrderPoolStatus" AS ENUM ('OPEN', 'CONFIRMED', 'CLOSED', 'CANCELLED');

ALTER TABLE "companies" ADD COLUMN "clientSegment" "ClientSegment" NOT NULL DEFAULT 'SINGLE';

CREATE TABLE "sku_order_pools" (
    "id" TEXT NOT NULL,
    "manufacturerCompanyId" TEXT NOT NULL,
    "manufacturerSkuId" TEXT NOT NULL,
    "status" "SkuOrderPoolStatus" NOT NULL DEFAULT 'OPEN',
    "title" TEXT,
    "targetQty" INTEGER,
    "note" TEXT,
    "confirmedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "sku_order_pools_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "sku_order_requests" (
    "id" TEXT NOT NULL,
    "clientCompanyId" TEXT NOT NULL,
    "manufacturerSkuId" TEXT NOT NULL,
    "poolId" TEXT,
    "qty" INTEGER NOT NULL,
    "note" TEXT,
    "calculationId" TEXT,
    "status" "SkuOrderRequestStatus" NOT NULL DEFAULT 'SUBMITTED',
    "rejectReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "sku_order_requests_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "sku_order_pools_manufacturerCompanyId_status_idx" ON "sku_order_pools"("manufacturerCompanyId", "status");
CREATE INDEX "sku_order_pools_manufacturerSkuId_status_idx" ON "sku_order_pools"("manufacturerSkuId", "status");
CREATE INDEX "sku_order_requests_clientCompanyId_status_idx" ON "sku_order_requests"("clientCompanyId", "status");
CREATE INDEX "sku_order_requests_manufacturerSkuId_status_idx" ON "sku_order_requests"("manufacturerSkuId", "status");
CREATE INDEX "sku_order_requests_poolId_idx" ON "sku_order_requests"("poolId");

ALTER TABLE "sku_order_pools" ADD CONSTRAINT "sku_order_pools_manufacturerCompanyId_fkey" FOREIGN KEY ("manufacturerCompanyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "sku_order_pools" ADD CONSTRAINT "sku_order_pools_manufacturerSkuId_fkey" FOREIGN KEY ("manufacturerSkuId") REFERENCES "manufacturer_skus"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "sku_order_requests" ADD CONSTRAINT "sku_order_requests_clientCompanyId_fkey" FOREIGN KEY ("clientCompanyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "sku_order_requests" ADD CONSTRAINT "sku_order_requests_manufacturerSkuId_fkey" FOREIGN KEY ("manufacturerSkuId") REFERENCES "manufacturer_skus"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "sku_order_requests" ADD CONSTRAINT "sku_order_requests_poolId_fkey" FOREIGN KEY ("poolId") REFERENCES "sku_order_pools"("id") ON DELETE SET NULL ON UPDATE CASCADE;
