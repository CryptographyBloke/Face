PRAGMA journal_mode=WAL;
CREATE TABLE IF NOT EXISTS migrations(version INTEGER PRIMARY KEY);
CREATE TABLE IF NOT EXISTS challenges(
  nonce TEXT PRIMARY KEY,
  expires INTEGER NOT NULL,
  used INTEGER NOT NULL DEFAULT 0 CHECK(used IN(0,1)),
  data TEXT NOT NULL CHECK(json_valid(data))
);
CREATE INDEX IF NOT EXISTS challenge_expiry ON challenges(expires);
CREATE TABLE IF NOT EXISTS records(
  kind TEXT NOT NULL CHECK(kind IN('profile','space','badge','role')),
  id TEXT NOT NULL,
  space TEXT,
  data TEXT NOT NULL CHECK(json_valid(data)),
  PRIMARY KEY(kind,id)
);
CREATE INDEX IF NOT EXISTS records_space ON records(kind,space,id);
INSERT OR IGNORE INTO migrations VALUES(1);
