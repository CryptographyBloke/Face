CREATE TABLE IF NOT EXISTS face_platform.agent_services(
 id uuid PRIMARY KEY,agent_id uuid NOT NULL REFERENCES face_platform.agents(id),owner text NOT NULL,agent_revision integer NOT NULL,revision integer NOT NULL DEFAULT 1,
 name text NOT NULL,category text NOT NULL,protocol text NOT NULL CHECK(protocol IN('mcp','a2a')),config jsonb NOT NULL,published boolean NOT NULL,paused boolean NOT NULL DEFAULT false,proof jsonb NOT NULL,created_at timestamptz NOT NULL DEFAULT now(),updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS agent_services_public ON face_platform.agent_services(published,category,updated_at DESC);
ALTER TABLE face_platform.agent_services ADD COLUMN IF NOT EXISTS execution_approved boolean NOT NULL DEFAULT false;
CREATE INDEX IF NOT EXISTS agent_services_owner ON face_platform.agent_services(owner);
CREATE TABLE IF NOT EXISTS face_platform.agent_runs(
 id uuid PRIMARY KEY,service_id text NOT NULL,service_version text NOT NULL,owner text,access_hash text NOT NULL,request_hash text NOT NULL,plan_hash text NOT NULL,plan jsonb NOT NULL,
 input jsonb NOT NULL CHECK(octet_length(input::text)<=20000),state text NOT NULL CHECK(state IN('awaiting_approval','executing','waiting_remote','needs_input','completed','failed','cancelled','execution_unknown')),
 execution_id uuid,lease_until timestamptz,cancel_requested boolean NOT NULL DEFAULT false,remote_task_id text,result jsonb CHECK(result IS NULL OR octet_length(result::text)<=180000),error_code text,
 payment_quote_id uuid REFERENCES face_platform.payment_quotes(id),created_at timestamptz NOT NULL DEFAULT now(),started_at timestamptz,completed_at timestamptz,updated_at timestamptz NOT NULL DEFAULT now(),expires_at timestamptz NOT NULL DEFAULT now()+interval '30 days'
);
CREATE INDEX IF NOT EXISTS agent_runs_owner ON face_platform.agent_runs(owner,created_at DESC);
CREATE INDEX IF NOT EXISTS agent_runs_service ON face_platform.agent_runs(service_id,created_at DESC);
CREATE INDEX IF NOT EXISTS agent_runs_expiry ON face_platform.agent_runs(expires_at);
CREATE TABLE IF NOT EXISTS face_platform.agent_run_events(
 id bigserial PRIMARY KEY,run_id uuid NOT NULL REFERENCES face_platform.agent_runs(id),kind text NOT NULL,data jsonb NOT NULL CHECK(octet_length(data::text)<=20000),created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS agent_run_events_run ON face_platform.agent_run_events(run_id,id);
CREATE TABLE IF NOT EXISTS face_platform.public_research_tasks(id uuid PRIMARY KEY,space_id text NOT NULL,state text NOT NULL CHECK(state IN('working','completed','cancelled','failed')),result jsonb,created_at timestamptz NOT NULL DEFAULT now(),expires_at timestamptz NOT NULL DEFAULT now()+interval '1 day');
CREATE OR REPLACE FUNCTION face_platform.apply_market_service(p_nonce text,p_actor text,p_action text,p_hash text,p_origin text,p_data jsonb,p_proof jsonb)
RETURNS jsonb LANGUAGE plpgsql AS $$
DECLARE c face_platform.challenges%ROWTYPE;a face_platform.agents%ROWTYPE;s face_platform.agent_services%ROWTYPE;orig text;
BEGIN
 SELECT * INTO c FROM face_platform.challenges WHERE nonce=p_nonce FOR UPDATE;
 IF NOT FOUND OR c.used_at IS NOT NULL OR c.expires_at<=now() OR c.actor<>p_actor OR c.action<>p_action OR c.payload_hash<>p_hash OR c.origin<>p_origin OR p_action<>'market.service.upsert' THEN RAISE EXCEPTION 'FACE_MARKET_AUTH';END IF;
 SELECT * INTO a FROM face_platform.agents WHERE id=(p_data->>'agentId')::uuid FOR UPDATE;
 IF NOT FOUND OR a.controller<>p_actor OR a.revision<>(p_data->>'agentRevision')::integer OR NOT a.published THEN RAISE EXCEPTION 'FACE_MARKET_OWNER';END IF;
 orig=p_data->>'endpointOrigin';
 IF NOT EXISTS(SELECT 1 FROM face_platform.agent_links l WHERE l.agent_id=a.id AND l.owner=p_actor AND l.status='active' AND l.agent_revision=a.revision AND l.controller_confirmed AND EXISTS(SELECT 1 FROM jsonb_array_elements(l.endpoint_evidence) e WHERE e->>'url'=orig AND (e->>'checkedAt')::timestamptz>now()-interval '24 hours')) THEN RAISE EXCEPTION 'FACE_MARKET_CONTROL';END IF;
 SELECT * INTO s FROM face_platform.agent_services WHERE id=(p_data->>'id')::uuid FOR UPDATE;
 IF FOUND THEN
  IF s.owner<>p_actor OR s.agent_id<>a.id OR s.revision<>(p_data->>'revision')::integer THEN RAISE EXCEPTION 'FACE_MARKET_REVISION';END IF;
  UPDATE face_platform.agent_services SET name=p_data->>'name',category=p_data->>'category',protocol=p_data->>'protocol',config=p_data,agent_revision=a.revision,revision=revision+1,execution_approved=false,published=(p_data->>'published')::boolean,paused=(p_data->>'paused')::boolean,proof=p_proof,updated_at=now() WHERE id=s.id RETURNING * INTO s;
 ELSE
  IF (p_data->>'revision')::integer<>0 THEN RAISE EXCEPTION 'FACE_MARKET_REVISION';END IF;
  INSERT INTO face_platform.agent_services(id,agent_id,owner,agent_revision,name,category,protocol,config,published,paused,proof) VALUES((p_data->>'id')::uuid,a.id,p_actor,a.revision,p_data->>'name',p_data->>'category',p_data->>'protocol',p_data,(p_data->>'published')::boolean,(p_data->>'paused')::boolean,p_proof) RETURNING * INTO s;
 END IF;
 UPDATE face_platform.challenges SET used_at=now() WHERE nonce=p_nonce;
 INSERT INTO face_platform.audit_events(actor,action,target,payload_hash,proof,outcome) VALUES(p_actor,p_action,s.id::text,p_hash,p_proof,'service_saved');
 RETURN jsonb_build_object('id',s.id,'revision',s.revision);
END;$$;
INSERT INTO face_platform.schema_migrations(version) VALUES(9) ON CONFLICT DO NOTHING;
