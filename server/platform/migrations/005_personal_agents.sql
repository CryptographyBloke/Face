CREATE TABLE IF NOT EXISTS face_platform.agent_links(
 id uuid PRIMARY KEY,agent_id uuid NOT NULL REFERENCES face_platform.agents(id),owner text NOT NULL,controller text NOT NULL,
 agent_revision integer NOT NULL,revision integer NOT NULL DEFAULT 1,status text NOT NULL CHECK(status IN('pending','active','disconnected','revoked')),
 origins text[] NOT NULL DEFAULT '{}',controller_confirmed boolean NOT NULL DEFAULT false,endpoint_evidence jsonb NOT NULL DEFAULT '[]',
 owner_proof jsonb NOT NULL,controller_proof jsonb,revocation_proof jsonb,created_at timestamptz NOT NULL DEFAULT now(),updated_at timestamptz NOT NULL DEFAULT now(),UNIQUE(owner,agent_id)
);
CREATE INDEX IF NOT EXISTS agent_links_actor ON face_platform.agent_links(owner,controller);
CREATE TABLE IF NOT EXISTS face_platform.agent_wallet_proofs(
 agent_id uuid NOT NULL REFERENCES face_platform.agents(id),wallet text NOT NULL,network text NOT NULL,agent_revision integer NOT NULL,
 revision integer NOT NULL DEFAULT 1,proof jsonb NOT NULL,revoked boolean NOT NULL DEFAULT false,checked_at timestamptz NOT NULL DEFAULT now(),PRIMARY KEY(agent_id,wallet,network)
);
CREATE TABLE IF NOT EXISTS face_platform.agent_registration_evidence(
 agent_id uuid PRIMARY KEY REFERENCES face_platform.agents(id),agent_revision integer NOT NULL,evidence jsonb NOT NULL,proof jsonb NOT NULL,checked_at timestamptz NOT NULL DEFAULT now()
);
CREATE OR REPLACE FUNCTION face_platform.apply_identity_change(p_nonce text,p_actor text,p_action text,p_hash text,p_origin text,p_data jsonb,p_proof jsonb)
RETURNS jsonb LANGUAGE plpgsql AS $$
DECLARE c face_platform.challenges%ROWTYPE;l face_platform.agent_links%ROWTYPE;a face_platform.agents%ROWTYPE;result jsonb;expected text;confirmed boolean;required_origins text[];all_endpoints boolean;changed integer;
BEGIN
 SELECT * INTO c FROM face_platform.challenges WHERE nonce=p_nonce FOR UPDATE;
 IF NOT FOUND OR c.used_at IS NOT NULL OR c.expires_at<=now() THEN RAISE EXCEPTION 'FACE_REPLAY';END IF;
 IF c.actor<>p_actor OR c.action<>p_action OR c.payload_hash<>p_hash OR c.origin<>p_origin THEN RAISE EXCEPTION 'FACE_AUTHORIZATION';END IF;
 IF p_action='identity.link' THEN
  SELECT * INTO a FROM face_platform.agents WHERE id=(p_data->>'agentId')::uuid FOR UPDATE;
  IF NOT FOUND OR (NOT a.published AND a.controller<>p_actor) OR a.revision<>(p_data->>'agentRevision')::integer THEN RAISE EXCEPTION 'FACE_AGENT';END IF;
  expected=lower(coalesce(a.metadata->>'agentController',a.controller));
  IF expected<>lower(p_data->>'controller') THEN RAISE EXCEPTION 'FACE_CONTROLLER';END IF;
  SELECT coalesce(array_agg(x),'{}') INTO required_origins FROM jsonb_array_elements_text(p_data->'origins') x;
  confirmed=expected=p_actor;
  INSERT INTO face_platform.agent_links(id,agent_id,owner,controller,agent_revision,status,origins,controller_confirmed,owner_proof,controller_proof)
   VALUES((p_data->>'id')::uuid,a.id,p_actor,expected,a.revision,CASE WHEN confirmed AND cardinality(required_origins)=0 THEN 'active' ELSE 'pending' END,required_origins,confirmed,p_proof,CASE WHEN confirmed THEN p_proof ELSE NULL END);
  result=jsonb_build_object('id',p_data->>'id','revision',1);
 ELSIF p_action LIKE 'identity.link.%' OR p_action='identity.verify.endpoint' THEN
  SELECT * INTO l FROM face_platform.agent_links WHERE id=(p_data->>'id')::uuid;
  IF NOT FOUND THEN RAISE EXCEPTION 'FACE_REVISION';END IF;
  SELECT * INTO a FROM face_platform.agents WHERE id=l.agent_id FOR UPDATE;
  SELECT * INTO l FROM face_platform.agent_links WHERE id=(p_data->>'id')::uuid FOR UPDATE;
  IF NOT FOUND OR l.revision<>(p_data->>'revision')::integer THEN RAISE EXCEPTION 'FACE_REVISION';END IF;
  IF p_action='identity.link.refresh' THEN
   IF l.owner<>p_actor OR a.revision<>(p_data->>'agentRevision')::integer OR l.status IN('revoked','disconnected') THEN RAISE EXCEPTION 'FACE_OWNER';END IF;
   expected=lower(coalesce(a.metadata->>'agentController',a.controller));
   SELECT coalesce(array_agg(x),'{}') INTO required_origins FROM jsonb_array_elements_text(p_data->'origins') x;
   UPDATE face_platform.agent_links SET controller=expected,agent_revision=a.revision,origins=required_origins,controller_confirmed=expected=p_actor,controller_proof=CASE WHEN expected=p_actor THEN p_proof ELSE NULL END,endpoint_evidence='[]',owner_proof=jsonb_build_object('initial',coalesce(owner_proof->'initial',owner_proof),'latest',p_proof),status=CASE WHEN expected=p_actor AND cardinality(required_origins)=0 THEN 'active' ELSE 'pending' END,revision=revision+1,updated_at=now() WHERE id=l.id;
  ELSIF p_action IN('identity.link.disconnect','identity.link.revoke') THEN
   IF l.owner<>p_actor OR l.status IN('revoked','disconnected') THEN RAISE EXCEPTION 'FACE_OWNER';END IF;
   UPDATE face_platform.agent_links SET status=CASE WHEN p_action='identity.link.revoke' THEN 'revoked' ELSE 'disconnected' END,revocation_proof=p_proof,revision=revision+1,updated_at=now() WHERE id=l.id;
  ELSE
   IF l.status IN('revoked','disconnected') OR a.revision<>l.agent_revision THEN RAISE EXCEPTION 'FACE_STALE';END IF;
   IF p_action='identity.link.confirm' THEN
    IF l.controller<>p_actor THEN RAISE EXCEPTION 'FACE_CONTROLLER';END IF;
    UPDATE face_platform.agent_links SET controller_confirmed=true,controller_proof=p_proof,revision=revision+1,updated_at=now() WHERE id=l.id;
   ELSIF p_action='identity.verify.endpoint' THEN
    IF l.owner<>p_actor OR NOT (p_data->'evidence'->>'url'=ANY(l.origins)) THEN RAISE EXCEPTION 'FACE_ENDPOINT';END IF;
    UPDATE face_platform.agent_links SET endpoint_evidence=(SELECT coalesce(jsonb_agg(v),'[]') FROM jsonb_array_elements(endpoint_evidence) v WHERE v->>'url'<>p_data->'evidence'->>'url')||jsonb_build_array(p_data->'evidence'),revision=revision+1,updated_at=now() WHERE id=l.id;
   ELSE RAISE EXCEPTION 'FACE_ACTION';END IF;
   SELECT NOT EXISTS(SELECT 1 FROM unnest(origins) o WHERE NOT EXISTS(SELECT 1 FROM jsonb_array_elements(endpoint_evidence) e WHERE e->>'url'=o)) INTO all_endpoints FROM face_platform.agent_links WHERE id=l.id;
   UPDATE face_platform.agent_links SET status=CASE WHEN controller_confirmed AND all_endpoints THEN 'active' ELSE 'pending' END WHERE id=l.id;
  END IF;
  SELECT jsonb_build_object('id',id,'revision',revision,'status',status) INTO result FROM face_platform.agent_links WHERE id=l.id;
 ELSIF p_action='identity.verify.wallet' THEN
  SELECT * INTO a FROM face_platform.agents WHERE id=(p_data->>'agentId')::uuid FOR UPDATE;
  IF NOT FOUND OR a.revision<>(p_data->>'agentRevision')::integer OR lower(p_data->>'wallet')<>p_actor THEN RAISE EXCEPTION 'FACE_WALLET';END IF;
  IF NOT EXISTS(SELECT 1 FROM jsonb_array_elements(coalesce(a.metadata->'services','[]')) s WHERE lower(s->'price'->>'payTo')=p_actor AND s->'price'->>'network'=p_data->>'network') THEN RAISE EXCEPTION 'FACE_WALLET';END IF;
  INSERT INTO face_platform.agent_wallet_proofs(agent_id,wallet,network,agent_revision,proof) VALUES(a.id,p_actor,p_data->>'network',a.revision,p_proof)
   ON CONFLICT(agent_id,wallet,network) DO UPDATE SET agent_revision=excluded.agent_revision,proof=excluded.proof,revoked=false,revision=face_platform.agent_wallet_proofs.revision+1,checked_at=now();
  result=jsonb_build_object('agentId',a.id,'wallet',p_actor,'verified',true);
 ELSIF p_action='identity.wallet.revoke' THEN
  SELECT * INTO a FROM face_platform.agents WHERE id=(p_data->>'agentId')::uuid FOR UPDATE;
  IF NOT FOUND OR (a.controller<>p_actor AND lower(p_data->>'wallet')<>p_actor) THEN RAISE EXCEPTION 'FACE_OWNER';END IF;
  UPDATE face_platform.agent_wallet_proofs SET revoked=true,revision=revision+1 WHERE agent_id=a.id AND wallet=lower(p_data->>'wallet') AND network=p_data->>'network' AND revision=(p_data->>'revision')::integer AND NOT revoked;
  GET DIAGNOSTICS changed=ROW_COUNT;IF changed<>1 THEN RAISE EXCEPTION 'FACE_REVISION';END IF;
  result=jsonb_build_object('agentId',a.id,'revoked',true);
 ELSIF p_action='identity.verify.registration' THEN
  SELECT * INTO a FROM face_platform.agents WHERE id=(p_data->>'agentId')::uuid FOR UPDATE;
  IF NOT FOUND OR a.controller<>p_actor OR a.revision<>(p_data->>'agentRevision')::integer THEN RAISE EXCEPTION 'FACE_OWNER';END IF;
  INSERT INTO face_platform.agent_registration_evidence(agent_id,agent_revision,evidence,proof) VALUES(a.id,a.revision,p_data->'evidence',p_proof)
   ON CONFLICT(agent_id) DO UPDATE SET agent_revision=excluded.agent_revision,evidence=excluded.evidence,proof=excluded.proof,checked_at=now();
  result=jsonb_build_object('agentId',a.id,'registrationChecked',true);
 ELSE RAISE EXCEPTION 'FACE_ACTION';END IF;
 UPDATE face_platform.challenges SET used_at=now() WHERE nonce=p_nonce;
 INSERT INTO face_platform.audit_events(actor,action,target,payload_hash,proof,outcome) VALUES(p_actor,p_action,coalesce(p_data->>'id',p_data->>'agentId'),p_hash,p_proof,'applied');
 RETURN result;
END;$$;
INSERT INTO face_platform.schema_migrations(version) VALUES(5) ON CONFLICT DO NOTHING;
