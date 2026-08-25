-- D26: durable orchestration (BackgroundJob, ServiceOutbox, ServiceCall)

CREATE TYPE "BackgroundJobStatus" AS ENUM ('QUEUED', 'RUNNING', 'DONE', 'FAILED', 'DEAD');
CREATE TYPE "ServiceOutboxStatus" AS ENUM ('PENDING', 'SENDING', 'DELIVERED', 'FAILED', 'DEAD');
CREATE TYPE "ServiceCallStatus" AS ENUM ('PENDING', 'OK', 'FAILED', 'TIMEOUT');

CREATE TABLE "background_jobs" (
    "id" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "payload" JSONB,
    "status" "BackgroundJobStatus" NOT NULL DEFAULT 'QUEUED',
    "runAfter" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "maxAttempts" INTEGER NOT NULL DEFAULT 5,
    "lockedAt" TIMESTAMP(3),
    "lockedBy" TEXT,
    "lastError" TEXT,
    "result" JSONB,
    "calculationId" TEXT,
    "paymentIntentId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3),
    CONSTRAINT "background_jobs_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "background_jobs_status_runAfter_idx" ON "background_jobs"("status", "runAfter");
CREATE INDEX "background_jobs_kind_idx" ON "background_jobs"("kind");
CREATE INDEX "background_jobs_calculationId_idx" ON "background_jobs"("calculationId");
CREATE INDEX "background_jobs_paymentIntentId_idx" ON "background_jobs"("paymentIntentId");

CREATE TABLE "service_outbox" (
    "id" TEXT NOT NULL,
    "channel" TEXT NOT NULL DEFAULT 'email',
    "template" TEXT NOT NULL DEFAULT 'generic',
    "to" TEXT NOT NULL,
    "payload" JSONB,
    "status" "ServiceOutboxStatus" NOT NULL DEFAULT 'PENDING',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "nextAttemptAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastError" TEXT,
    "deliveredAt" TIMESTAMP(3),
    "calculationId" TEXT,
    "paymentIntentId" TEXT,
    "companyId" TEXT,
    "ledgerEntryId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "service_outbox_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "service_outbox_status_nextAttemptAt_idx" ON "service_outbox"("status", "nextAttemptAt");
CREATE INDEX "service_outbox_template_idx" ON "service_outbox"("template");
CREATE INDEX "service_outbox_calculationId_idx" ON "service_outbox"("calculationId");
CREATE INDEX "service_outbox_companyId_idx" ON "service_outbox"("companyId");

CREATE TABLE "service_calls" (
    "id" TEXT NOT NULL,
    "service" TEXT NOT NULL,
    "operation" TEXT NOT NULL,
    "status" "ServiceCallStatus" NOT NULL DEFAULT 'PENDING',
    "correlationId" TEXT,
    "requestMeta" JSONB,
    "responseMeta" JSONB,
    "durationMs" INTEGER,
    "error" TEXT,
    "calculationId" TEXT,
    "paymentIntentId" TEXT,
    "shippingRequestId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3),
    CONSTRAINT "service_calls_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "service_calls_service_createdAt_idx" ON "service_calls"("service", "createdAt");
CREATE INDEX "service_calls_status_idx" ON "service_calls"("status");
CREATE INDEX "service_calls_correlationId_idx" ON "service_calls"("correlationId");
CREATE INDEX "service_calls_calculationId_idx" ON "service_calls"("calculationId");
