-- Clarify-hints P2/P3: product profiles, attribute options, dependency edges, hs feedback.

CREATE TABLE "clarify_product_profiles" (
    "id" TEXT NOT NULL,
    "canonicalText" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "confidence" DOUBLE PRECISION NOT NULL DEFAULT 0.5,
    "hsCodeDigits" TEXT,
    "usageCount" INTEGER NOT NULL DEFAULT 1,
    "attrsSnapshot" JSONB,
    "sourceCalculationId" TEXT,
    "sourceItemId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "clarify_product_profiles_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "clarify_product_profiles_category_idx" ON "clarify_product_profiles"("category");
CREATE INDEX "clarify_product_profiles_hsCodeDigits_idx" ON "clarify_product_profiles"("hsCodeDigits");
CREATE INDEX "clarify_product_profiles_usageCount_idx" ON "clarify_product_profiles"("usageCount");
CREATE INDEX "clarify_product_profiles_updatedAt_idx" ON "clarify_product_profiles"("updatedAt");

CREATE TABLE "clarify_attribute_options" (
    "id" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "attrKey" TEXT NOT NULL,
    "optionId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "searchValue" TEXT NOT NULL,
    "weight" DOUBLE PRECISION NOT NULL DEFAULT 1,
    "skipCount" INTEGER NOT NULL DEFAULT 0,
    "pickCount" INTEGER NOT NULL DEFAULT 0,
    "attrsPatch" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "clarify_attribute_options_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "clarify_attribute_options_category_attrKey_optionId_key" ON "clarify_attribute_options"("category", "attrKey", "optionId");
CREATE INDEX "clarify_attribute_options_category_attrKey_idx" ON "clarify_attribute_options"("category", "attrKey");

CREATE TABLE "clarify_dependency_edges" (
    "id" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "parentAttr" TEXT NOT NULL DEFAULT '',
    "parentValue" TEXT NOT NULL DEFAULT '',
    "childAttr" TEXT NOT NULL,
    "weight" DOUBLE PRECISION NOT NULL DEFAULT 1,
    "askCount" INTEGER NOT NULL DEFAULT 0,
    "skipCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "clarify_dependency_edges_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "clarify_dependency_edges_category_parentAttr_parentValue_childAttr_key" ON "clarify_dependency_edges"("category", "parentAttr", "parentValue", "childAttr");
CREATE INDEX "clarify_dependency_edges_category_idx" ON "clarify_dependency_edges"("category");

CREATE TABLE "clarify_hs_feedback" (
    "id" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "answersJson" JSONB,
    "tokens" TEXT,
    "hsCodeFinal" TEXT NOT NULL,
    "hsCodeDigits" TEXT NOT NULL,
    "sourceCalculationId" TEXT,
    "sourceItemId" TEXT,
    "approvedByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "clarify_hs_feedback_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "clarify_hs_feedback_category_createdAt_idx" ON "clarify_hs_feedback"("category", "createdAt");
CREATE INDEX "clarify_hs_feedback_hsCodeDigits_idx" ON "clarify_hs_feedback"("hsCodeDigits");
CREATE INDEX "clarify_hs_feedback_createdAt_idx" ON "clarify_hs_feedback"("createdAt");
