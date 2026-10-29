-- 003b_asset_valuations.sql – valuation history for each asset (FR-06)
CREATE TABLE IF NOT EXISTS asset_valuations (
  id             BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  asset_id       BIGINT        NOT NULL REFERENCES assets(id) ON DELETE CASCADE,
  valuation_date DATE          NOT NULL,
  value          NUMERIC(15,2) NOT NULL CHECK (value >= 0),
  source         TEXT          NOT NULL CHECK (source IN ('manual-entry', 'revaluation')),
  recorded_at    TIMESTAMPTZ   NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_valuations_asset ON asset_valuations (asset_id, valuation_date);

-- Give assets created before this migration their first history point.
INSERT INTO asset_valuations (asset_id, valuation_date, value, source)
SELECT a.id, a.valuation_date, a.current_value, 'manual-entry'
  FROM assets a
 WHERE NOT EXISTS (SELECT 1 FROM asset_valuations v WHERE v.asset_id = a.id);
