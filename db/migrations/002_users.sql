-- 002_users.sql – user accounts and roles (FR-01, FR-04, SR-01)
DO $$ BEGIN
  CREATE TYPE user_role AS ENUM ('individual', 'advisor');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS users (
  id            BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  name          TEXT        NOT NULL CHECK (length(trim(name)) >= 2),
  email         TEXT        NOT NULL UNIQUE CHECK (email = lower(email)),
  password_hash TEXT        NOT NULL,
  role          user_role   NOT NULL DEFAULT 'individual',
  pan_number    CHAR(10)    UNIQUE CHECK (pan_number ~ '^[A-Z]{5}[0-9]{4}[A-Z]$'),
  advisor_id    BIGINT      REFERENCES users(id) ON DELETE SET NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
