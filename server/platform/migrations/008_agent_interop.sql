CREATE TABLE IF NOT EXISTS face_platform.agent_discovery_checks(agent_id uuid NOT NULL REFERENCES face_platform.agents(id),protocol text NOT NULL CHECK(protocol IN('mcp','a2a')),endpoint_url text NOT NULL,agent_revision integer NOT NULL,evidence jsonb NOT NULL,proof jsonb NOT NULL,checked_at timestamptz NOT NULL DEFAULT now(),PRIMARY KEY(agent_id,protocol,endpoint_url));
CREATE OR REPLACE FUNCTION face_platform.apply_discovery_check(p_nonce text,p_actor text,p_action text,p_hash text,p_origin text,p_data jsonb,p_proof jsonb,p_evidence jsonb)
RETURNS jsonb LANGUAGE plpgsql AS $$
DECLARE c face_platform.challenges%ROWTYPE;a face_platform.agents%ROWTYPE;proto text;
BEGIN
 SELECT * INTO c FROM face_platform.challenges WHERE nonce=p_nonce FOR UPDATE;
 IF NOT FOUND OR c.used_at IS NOT NULL OR c.expires_at<=now() OR c.actor<>p_actor OR c.action<>p_action OR c.payload_hash<>p_hash OR c.origin<>p_origin THEN RAISE EXCEPTION 'FACE_DISCOVERY_AUTH';END IF;
 SELECT * INTO a FROM face_platform.agents WHERE id=(p_data->>'id')::uuid FOR UPDATE;
 IF NOT FOUND OR a.controller<>p_actor OR a.revision<>(p_data->>'revision')::integer THEN RAISE EXCEPTION 'FACE_DISCOVERY_PROFILE';END IF;
 proto=CASE WHEN p_action='agent.probe.mcp' THEN 'mcp' WHEN p_action='agent.probe.a2a' THEN 'a2a' ELSE NULL END;
 IF proto IS NULL OR NOT EXISTS(SELECT 1 FROM jsonb_array_elements(a.metadata->'endpoints') e WHERE e->>'protocol'=proto AND e->>'url'=p_data->>'endpointUrl') THEN RAISE EXCEPTION 'FACE_DISCOVERY_ENDPOINT';END IF;
 IF NOT EXISTS(SELECT 1 FROM face_platform.agent_links l WHERE l.agent_id=a.id AND l.owner=p_actor AND l.status='active' AND l.agent_revision=a.revision AND l.controller_confirmed AND EXISTS(SELECT 1 FROM jsonb_array_elements(l.endpoint_evidence) e WHERE e->>'url'=p_data->>'endpointOrigin' AND (e->>'checkedAt')::timestamptz>now()-interval '24 hours')) THEN RAISE EXCEPTION 'FACE_DISCOVERY_CONTROL';END IF;
 INSERT INTO face_platform.agent_discovery_checks(agent_id,protocol,endpoint_url,agent_revision,evidence,proof) VALUES(a.id,proto,p_data->>'endpointUrl',a.revision,p_evidence,p_proof) ON CONFLICT(agent_id,protocol,endpoint_url) DO UPDATE SET agent_revision=excluded.agent_revision,evidence=excluded.evidence,proof=excluded.proof,checked_at=now();
 UPDATE face_platform.challenges SET used_at=now() WHERE nonce=p_nonce;
 INSERT INTO face_platform.audit_events(actor,action,target,payload_hash,proof,outcome) VALUES(p_actor,p_action,a.id::text,p_hash,p_proof,'metadata_checked');
 RETURN jsonb_build_object('id',a.id,'protocol',proto,'status','metadata_checked');
END;$$;
INSERT INTO face_platform.schema_migrations(version) VALUES(8) ON CONFLICT DO NOTHING;
