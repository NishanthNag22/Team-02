-- 009b_credit_score.sql – derived credit score history (FR-19). Not a bureau score.
CREATE TABLE IF NOT EXISTS credit_score_history (
  id           BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id      BIGINT      NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  score        INTEGER     NOT NULL CHECK (score BETWEEN 300 AND 900),
  factors      JSONB       NOT NULL,
  computed_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_score_user_time ON credit_score_history (user_id, computed_at DESC);
