-- Wallet Face resolver API schema.
-- Addresses are stored lowercase.

CREATE TABLE IF NOT EXISTS accounts (
  address TEXT PRIMARY KEY,
  plan TEXT NOT NULL DEFAULT 'free',
  stripe_customer_id TEXT,
  stripe_subscription_id TEXT,
  subscription_status TEXT,
  current_period_end INTEGER,
  created_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS accounts_subscription ON accounts (stripe_subscription_id);
CREATE INDEX IF NOT EXISTS accounts_customer ON accounts (stripe_customer_id);

-- Only the SHA-256 hash of each key is stored; the full key is shown once.
CREATE TABLE IF NOT EXISTS api_keys (
  key_hash TEXT PRIMARY KEY,
  address TEXT NOT NULL,
  prefix TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  revoked_at INTEGER
);

CREATE INDEX IF NOT EXISTS api_keys_address ON api_keys (address);

-- Monthly request counters. period = 'YYYY-MM' (UTC).
CREATE TABLE IF NOT EXISTS usage (
  address TEXT NOT NULL,
  period TEXT NOT NULL,
  count INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (address, period)
);

-- One-time sign-in challenges.
CREATE TABLE IF NOT EXISTS nonces (
  nonce TEXT PRIMARY KEY,
  address TEXT NOT NULL,
  expires_at INTEGER NOT NULL
);
