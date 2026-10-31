-- 008b_news.sql – cached RBI press releases (FR-25)
CREATE TABLE IF NOT EXISTS news_articles (
  id               BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  guid             TEXT        NOT NULL UNIQUE,
  title            TEXT        NOT NULL,
  link             TEXT        NOT NULL,
  summary          TEXT        NOT NULL DEFAULT '',
  category         TEXT        NOT NULL CHECK (category IN ('Monetary Policy', 'Banking', 'Regulation', 'Markets', 'Other')),
  rate_change_bps  INTEGER     CHECK (rate_change_bps BETWEEN -500 AND 500),
  published_at     TIMESTAMPTZ NOT NULL,
  fetched_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_news_published ON news_articles (published_at DESC);