-- pgvector embeddings for verified_determinations semantic match (БД-2 precedent-v2).
-- Fail-open on hosts without the vector extension (e.g. sweb shared Postgres):
-- lexical/fingerprint precedent-v1 remains available; compose uses pgvector/pgvector:pg17.

DO $$
BEGIN
  CREATE EXTENSION IF NOT EXISTS vector;

  ALTER TABLE "verified_determinations"
    ADD COLUMN IF NOT EXISTS "embedding" vector(1024);

  IF NOT EXISTS (
    SELECT 1
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE c.relname = 'verified_determinations_embedding_idx'
      AND n.nspname = 'public'
  ) THEN
    CREATE INDEX "verified_determinations_embedding_idx"
      ON "verified_determinations"
      USING hnsw ("embedding" vector_cosine_ops);
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'precedent_embeddings skipped (pgvector unavailable): %', SQLERRM;
END $$;
