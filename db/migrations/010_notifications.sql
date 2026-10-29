-- 010_notifications.sql – in-app EMI reminders (FR-24)
DO $$ BEGIN
  CREATE TYPE notification_kind AS ENUM ('due_soon', 'overdue');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS notifications (
  id              BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id         BIGINT            NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  installment_id  BIGINT            NOT NULL REFERENCES emi_schedule(id) ON DELETE CASCADE,
  kind            notification_kind NOT NULL,
  title           TEXT              NOT NULL,
  body            TEXT              NOT NULL,
  is_read         BOOLEAN           NOT NULL DEFAULT false,
  created_at      TIMESTAMPTZ       NOT NULL DEFAULT now(),
  -- at most one reminder per installment and kind
  UNIQUE (installment_id, kind)
);

CREATE INDEX IF NOT EXISTS idx_notifications_unread ON notifications (user_id, created_at DESC) WHERE NOT is_read;
