-- ManufacturerProposal: client/broker propose; ADMIN approve → Company MANUFACTURER shell

CREATE TYPE "ManufacturerProposalStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

CREATE TABLE "manufacturer_proposals" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "country" TEXT,
    "note" TEXT,
    "status" "ManufacturerProposalStatus" NOT NULL DEFAULT 'PENDING',
    "sourceRole" "UserRole" NOT NULL,
    "proposedByUserId" TEXT NOT NULL,
    "approvedCompanyId" TEXT,
    "reviewedByUserId" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "rejectReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "manufacturer_proposals_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "manufacturer_proposals_status_createdAt_idx" ON "manufacturer_proposals"("status", "createdAt");
CREATE INDEX "manufacturer_proposals_proposedByUserId_status_idx" ON "manufacturer_proposals"("proposedByUserId", "status");
CREATE INDEX "manufacturer_proposals_name_idx" ON "manufacturer_proposals"("name");

ALTER TABLE "manufacturer_proposals" ADD CONSTRAINT "manufacturer_proposals_proposedByUserId_fkey" FOREIGN KEY ("proposedByUserId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "manufacturer_proposals" ADD CONSTRAINT "manufacturer_proposals_approvedCompanyId_fkey" FOREIGN KEY ("approvedCompanyId") REFERENCES "companies"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "manufacturer_proposals" ADD CONSTRAINT "manufacturer_proposals_reviewedByUserId_fkey" FOREIGN KEY ("reviewedByUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
