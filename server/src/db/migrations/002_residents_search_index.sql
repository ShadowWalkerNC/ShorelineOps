-- Migration 002: add trigram index for fast ILIKE search on residents
-- Run: psql $DATABASE_URL -f server/src/db/migrations/002_residents_search_index.sql

CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX IF NOT EXISTS idx_residents_name_trgm
  ON residents USING GIN (name gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_residents_room_trgm
  ON residents USING GIN (room gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_residents_diet_type_trgm
  ON residents USING GIN (diet_type gin_trgm_ops);
