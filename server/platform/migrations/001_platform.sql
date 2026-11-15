CREATE SCHEMA IF NOT EXISTS face_platform;
CREATE TABLE IF NOT EXISTS face_platform.schema_migrations(version integer PRIMARY KEY,applied_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS face_platform.challenges(
 nonce text PRIMARY KEY CHECK(nonce ~ '^0x[0-9a-f]{64}$'), actor text NOT NULL, action text NOT NULL,
 payload jsonb NOT NULL, payload_hash text NOT NULL, origin text NOT NULL, expires_at timestamptz NOT NULL,
 used_at timestamptz, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS challenges_expiry ON face_platform.challenges(expires_at);
CREATE TABLE IF NOT EXISTS face_platform.agents(
 id uuid PRIMARY KEY, controller text NOT NULL, name text NOT NULL CHECK(length(name)<=100), metadata jsonb NOT NULL,
 published boolean NOT NULL DEFAULT true, revision integer NOT NULL DEFAULT 1 CHECK(revision>0), proof jsonb NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS agents_controller ON face_platform.agents(controller);
CREATE TABLE IF NOT EXISTS face_platform.reports(
 id uuid PRIMARY KEY, owner text NOT NULL, space_id text NOT NULL, title text NOT NULL CHECK(length(title)<=160),
 summary text NOT NULL CHECK(length(summary)<=12000), evidence jsonb NOT NULL, public boolean NOT NULL DEFAULT false,
 revision integer NOT NULL DEFAULT 1, proof jsonb NOT NULL, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS reports_owner ON face_platform.reports(owner,created_at DESC);
CREATE TABLE IF NOT EXISTS face_platform.organizations(
 space_id text PRIMARY KEY, admin text NOT NULL, name text NOT NULL, config jsonb NOT NULL,
 revision integer NOT NULL DEFAULT 1, proof jsonb NOT NULL, updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS face_platform.actions(
 id uuid PRIMARY KEY, owner text NOT NULL, space_id text NOT NULL, kind text NOT NULL,
 content jsonb NOT NULL, content_hash text NOT NULL,
 state text NOT NULL DEFAULT 'prepared' CHECK(state IN ('prepared','approved','executed','cancelled','failed')),
 revision integer NOT NULL DEFAULT 1, preparation_proof jsonb NOT NULL, approval_proof jsonb, execution_proof jsonb,
 result jsonb, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS actions_owner ON face_platform.actions(owner,created_at DESC);
CREATE TABLE IF NOT EXISTS face_platform.organization_records(
 id text PRIMARY KEY, space_id text NOT NULL, kind text NOT NULL, issuer text NOT NULL, value jsonb NOT NULL,
 proof jsonb NOT NULL, revoked_at timestamptz, issued_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS face_platform.audit_events(
 id bigserial PRIMARY KEY,actor text NOT NULL,action text NOT NULL,target text NOT NULL,payload_hash text NOT NULL,
 proof jsonb NOT NULL, outcome text NOT NULL, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS audit_target ON face_platform.audit_events(target,created_at DESC);
CREATE TABLE IF NOT EXISTS face_platform.proposals(
 space_id text NOT NULL,id text NOT NULL,title text NOT NULL,created bigint NOT NULL,privacy text,
 metadata jsonb NOT NULL DEFAULT '{}',fetched_at timestamptz NOT NULL DEFAULT now(),PRIMARY KEY(space_id,id)
);
CREATE TABLE IF NOT EXISTS face_platform.votes(
 space_id text NOT NULL,id text NOT NULL,voter text NOT NULL,proposal_id text NOT NULL,created bigint NOT NULL,
 voting_power numeric NOT NULL,excluded boolean NOT NULL DEFAULT false,fetched_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(space_id,id)
);
CREATE INDEX IF NOT EXISTS votes_space_created ON face_platform.votes(space_id,created);
CREATE TABLE IF NOT EXISTS face_platform.scan_jobs(
 space_id text PRIMARY KEY,cutoff bigint NOT NULL,proposal_offset integer NOT NULL DEFAULT 0,vote_offset integer NOT NULL DEFAULT 0,
 proposals_complete boolean NOT NULL DEFAULT false,votes_complete boolean NOT NULL DEFAULT false,
 proposals_scanned integer NOT NULL DEFAULT 0,votes_scanned integer NOT NULL DEFAULT 0,
 status text NOT NULL DEFAULT 'pending',lease_until timestamptz,last_error text,updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS face_platform.quota_buckets(
 key text PRIMARY KEY,count bigint NOT NULL DEFAULT 0,expires_at timestamptz NOT NULL
);
INSERT INTO face_platform.schema_migrations(version) VALUES(1) ON CONFLICT DO NOTHING;
