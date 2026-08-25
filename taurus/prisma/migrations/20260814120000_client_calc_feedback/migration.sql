-- Client reaction on assembled calculation result (DONE)
ALTER TABLE "calculations"
  ADD COLUMN "clientFeedbackReaction" TEXT,
  ADD COLUMN "clientFeedbackComment" TEXT,
  ADD COLUMN "clientFeedbackAt" TIMESTAMP(3);
