-- 003_assets.sql – what the user owns (FR-05)
DO $$ BEGIN
  CREATE TYPE asset_type AS ENUM ('gold','property','equity','mutual_fund','epf','ppf','fd','vehicle','cash','other');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE asset_liquidity AS ENUM ('liquid','illiquid');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS assets (
  id             BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id        BIGINT          NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name           TEXT            NOT NULL CHECK (length(trim(name)) > 0),
  asset_type     asset_type      NOT NULL,
  liquidity      asset_liquidity NOT NULL,
  purchase_value NUMERIC(15,2)   NOT NULL CHECK (purchase_value >= 0),
  current_value  NUMERIC(15,2)   NOT NULL CHECK (current_value >= 0),
  purchase_date  DATE            NOT NULL,
  valuation_date DATE            NOT NULL,
  notes          TEXT,
  created_at     TIMESTAMPTZ     NOT NULL DEFAULT now(),
  CONSTRAINT assets_valuation_after_purchase CHECK (valuation_date >= purchase_date)
);

CREATE INDEX IF NOT EXISTS idx_assets_user ON assets (user_id, asset_type);
