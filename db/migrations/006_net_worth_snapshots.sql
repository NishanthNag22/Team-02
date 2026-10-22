-- 006_net_worth_snapshots.sql – one net worth snapshot per user per day, for the trend chart (FR-18)
CREATE TABLE IF NOT EXISTS net_worth_snapshots (
  id                BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id           BIGINT        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  snapshot_date     DATE          NOT NULL,
  total_assets      NUMERIC(15,2) NOT NULL,
  total_liabilities NUMERIC(15,2) NOT NULL,
  net_worth         NUMERIC(15,2) NOT NULL,
  UNIQUE (user_id, snapshot_date)
);
