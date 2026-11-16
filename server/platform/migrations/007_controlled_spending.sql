CREATE TABLE IF NOT EXISTS face_platform.spending_policies(
 id uuid PRIMARY KEY,link_id uuid NOT NULL REFERENCES face_platform.agent_links(id),owner text NOT NULL,agent_wallet text NOT NULL,network text NOT NULL,asset text NOT NULL,
 max_per_transaction numeric(78,0) NOT NULL CHECK(max_per_transaction>0),daily_limit numeric(78,0) NOT NULL,total_limit numeric(78,0) NOT NULL,recipients text[] NOT NULL,
 expires_at timestamptz NOT NULL,revision integer NOT NULL DEFAULT 1,revoked boolean NOT NULL DEFAULT false,creation_proof jsonb NOT NULL,revocation_proof jsonb,created_at timestamptz NOT NULL DEFAULT now(),CHECK(max_per_transaction<=daily_limit AND daily_limit<=total_limit)
);
CREATE INDEX IF NOT EXISTS spending_policies_wallet ON face_platform.spending_policies(agent_wallet);
CREATE TABLE IF NOT EXISTS face_platform.spending_intents(
 id uuid PRIMARY KEY REFERENCES face_platform.payment_quotes(id),policy_id uuid NOT NULL REFERENCES face_platform.spending_policies(id),owner text NOT NULL,agent_wallet text NOT NULL,
 amount numeric(78,0) NOT NULL,resource_url text NOT NULL,requirements_hash text NOT NULL,expires_at timestamptz NOT NULL,revision integer NOT NULL DEFAULT 1,
 state text NOT NULL CHECK(state IN('approved','executing','cancelled')),authorization_nonce text,payload_hash text,approval_proof jsonb NOT NULL,cancellation_proof jsonb,approved_at timestamptz NOT NULL DEFAULT now(),executing_at timestamptz
);
CREATE TABLE IF NOT EXISTS face_platform.spending_events(id bigserial PRIMARY KEY,target text NOT NULL,action text NOT NULL,actor text NOT NULL,proof jsonb NOT NULL,created_at timestamptz NOT NULL DEFAULT now());
CREATE OR REPLACE FUNCTION face_platform.apply_spending_change(p_nonce text,p_actor text,p_action text,p_hash text,p_origin text,p_data jsonb,p_proof jsonb)
RETURNS jsonb LANGUAGE plpgsql AS $$
DECLARE c face_platform.challenges%ROWTYPE;p face_platform.spending_policies%ROWTYPE;l face_platform.agent_links%ROWTYPE;a face_platform.agents%ROWTYPE;q face_platform.payment_quotes%ROWTYPE;i face_platform.spending_intents%ROWTYPE;day_used numeric;total_used numeric;price numeric;result jsonb;
BEGIN
 SELECT * INTO c FROM face_platform.challenges WHERE nonce=p_nonce FOR UPDATE;
 IF NOT FOUND OR c.used_at IS NOT NULL OR c.expires_at<=now() OR c.actor<>p_actor OR c.action<>p_action OR c.payload_hash<>p_hash OR c.origin<>p_origin THEN RAISE EXCEPTION 'FACE_SPEND_AUTH';END IF;
 IF p_action='spend.policy.create' THEN
  SELECT * INTO l FROM face_platform.agent_links WHERE id=(p_data->>'linkId')::uuid FOR UPDATE;
  SELECT * INTO a FROM face_platform.agents WHERE id=l.agent_id;
  IF l.owner<>p_actor OR l.status<>'active' OR NOT l.controller_confirmed OR a.revision<>l.agent_revision OR l.controller<>lower(p_data->>'agentWallet') OR l.owner=l.controller OR l.revision<>(p_data->>'linkRevision')::integer THEN RAISE EXCEPTION 'FACE_SPEND_LINK';END IF;
  IF to_timestamp((p_data->>'expiresAt')::bigint)<=now() OR (p_data->>'network')<>'eip155:84532' OR lower(p_data->>'asset')<>lower('0x036CbD53842c5426634e7929541eC2318f3dCF7e') THEN RAISE EXCEPTION 'FACE_SPEND_POLICY';END IF;
  INSERT INTO face_platform.spending_policies(id,link_id,owner,agent_wallet,network,asset,max_per_transaction,daily_limit,total_limit,recipients,expires_at,creation_proof)
  VALUES((p_data->>'id')::uuid,l.id,p_actor,l.controller,p_data->>'network',lower(p_data->>'asset'),(p_data->>'maxPerTransaction')::numeric,(p_data->>'dailyLimit')::numeric,(p_data->>'totalLimit')::numeric,ARRAY(SELECT lower(v) FROM jsonb_array_elements_text(p_data->'recipients') v),to_timestamp((p_data->>'expiresAt')::bigint),p_proof);
  result=jsonb_build_object('id',p_data->>'id','revision',1);
 ELSIF p_action='spend.policy.revoke' THEN
  SELECT * INTO p FROM face_platform.spending_policies WHERE id=(p_data->>'id')::uuid FOR UPDATE;
  IF NOT FOUND OR p.owner<>p_actor OR p.revoked OR p.revision<>(p_data->>'revision')::integer THEN RAISE EXCEPTION 'FACE_SPEND_OWNER';END IF;
  UPDATE face_platform.spending_policies SET revoked=true,revision=revision+1,revocation_proof=p_proof WHERE id=p.id;
  result=jsonb_build_object('id',p.id,'revoked',true);
 ELSIF p_action='spend.intent.approve' THEN
  SELECT * INTO p FROM face_platform.spending_policies WHERE id=(p_data->>'policyId')::uuid FOR UPDATE;
  IF NOT FOUND OR p.owner<>p_actor OR p.revoked OR p.revision<>(p_data->>'policyRevision')::integer OR p.expires_at<=now() THEN RAISE EXCEPTION 'FACE_SPEND_OWNER';END IF;
  SELECT * INTO l FROM face_platform.agent_links WHERE id=p.link_id;SELECT * INTO a FROM face_platform.agents WHERE id=l.agent_id;
  IF l.status<>'active' OR NOT l.controller_confirmed OR a.revision<>l.agent_revision OR l.controller<>p.agent_wallet THEN RAISE EXCEPTION 'FACE_SPEND_LINK';END IF;
  SELECT * INTO q FROM face_platform.payment_quotes WHERE id=(p_data->>'id')::uuid;
  IF NOT FOUND OR q.expires_at<=now() OR q.resource_url<>p_data->>'resourceUrl' OR q.requirements<>p_data->'requirements' OR q.requirements->>'network'<>p.network OR lower(q.requirements->>'asset')<>p.asset OR NOT(lower(q.requirements->>'payTo')=ANY(p.recipients)) THEN RAISE EXCEPTION 'FACE_SPEND_RESOURCE';END IF;
  IF EXISTS(SELECT 1 FROM face_platform.payment_receipts WHERE id=q.id) THEN RAISE EXCEPTION 'FACE_SPEND_ALREADY_SUBMITTED';END IF;
  price=(q.requirements->>'amount')::numeric;
  SELECT coalesce(sum(amount),0),coalesce(sum(amount) FILTER(WHERE approved_at>=(date_trunc('day',now() AT TIME ZONE 'UTC') AT TIME ZONE 'UTC')),0) INTO total_used,day_used FROM face_platform.spending_intents WHERE policy_id=p.id;
  IF price<=0 OR price>p.max_per_transaction OR total_used+price>p.total_limit OR day_used+price>p.daily_limit THEN RAISE EXCEPTION 'FACE_SPEND_LIMIT';END IF;
  INSERT INTO face_platform.spending_intents(id,policy_id,owner,agent_wallet,amount,resource_url,requirements_hash,expires_at,state,approval_proof)
  VALUES(q.id,p.id,p_actor,p.agent_wallet,price,q.resource_url,p_data->>'requirementsHash',least(p.expires_at,q.expires_at,now()+interval '5 minutes'),'approved',p_proof);
  result=jsonb_build_object('id',q.id,'approved',true);
 ELSIF p_action='spend.intent.cancel' THEN
  SELECT * INTO i FROM face_platform.spending_intents WHERE id=(p_data->>'id')::uuid FOR UPDATE;
  IF NOT FOUND OR i.owner<>p_actor OR i.state<>'approved' OR i.revision<>(p_data->>'revision')::integer THEN RAISE EXCEPTION 'FACE_SPEND_OWNER';END IF;
  UPDATE face_platform.spending_intents SET state='cancelled',revision=revision+1,cancellation_proof=p_proof WHERE id=i.id;
  result=jsonb_build_object('id',i.id,'cancelled',true);
 ELSE RAISE EXCEPTION 'FACE_SPEND_ACTION';END IF;
 UPDATE face_platform.challenges SET used_at=now() WHERE nonce=p_nonce;
 INSERT INTO face_platform.spending_events(target,action,actor,proof) VALUES(p_data->>'id',p_action,p_actor,p_proof);
 INSERT INTO face_platform.audit_events(actor,action,target,payload_hash,proof,outcome) VALUES(p_actor,p_action,p_data->>'id',p_hash,p_proof,'applied');
 RETURN result;
END;$$;
CREATE OR REPLACE FUNCTION face_platform.guard_payment_spending()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE p face_platform.spending_policies%ROWTYPE;i face_platform.spending_intents%ROWTYPE;l face_platform.agent_links%ROWTYPE;a face_platform.agents%ROWTYPE;q face_platform.payment_quotes%ROWTYPE;
BEGIN
 IF TG_OP='UPDATE' AND NOT(NEW.state='settling' AND OLD.state<>'settling') THEN RETURN NEW;END IF;
 IF NOT EXISTS(SELECT 1 FROM face_platform.spending_policies WHERE agent_wallet=NEW.payer) THEN RETURN NEW;END IF;
 SELECT * INTO i FROM face_platform.spending_intents WHERE id=NEW.id;
 IF NOT FOUND THEN RAISE EXCEPTION 'FACE_SPEND_APPROVAL_REQUIRED';END IF;
 SELECT * INTO p FROM face_platform.spending_policies WHERE id=i.policy_id FOR UPDATE;
 SELECT * INTO i FROM face_platform.spending_intents WHERE id=NEW.id FOR UPDATE;
 SELECT * INTO q FROM face_platform.payment_quotes WHERE id=NEW.id;
 SELECT * INTO l FROM face_platform.agent_links WHERE id=p.link_id;SELECT * INTO a FROM face_platform.agents WHERE id=l.agent_id;
 IF p.revoked OR p.expires_at<=now() OR i.expires_at<=now() OR i.state<>'approved' OR i.agent_wallet<>NEW.payer OR l.status<>'active' OR a.revision<>l.agent_revision OR l.controller<>NEW.payer OR NEW.network<>p.network OR NEW.asset<>p.asset OR NEW.amount<>i.amount OR NEW.receiver<>lower(q.requirements->>'payTo') OR NOT(NEW.receiver=ANY(p.recipients)) OR q.resource_url<>i.resource_url OR to_timestamp((NEW.authorization_data->>'validBefore')::bigint)>i.expires_at THEN RAISE EXCEPTION 'FACE_SPEND_POLICY_REJECTED';END IF;
 IF TG_OP='UPDATE' THEN
  UPDATE face_platform.spending_intents SET state='executing',authorization_nonce=NEW.authorization_nonce,payload_hash=NEW.payload_hash,executing_at=now() WHERE id=i.id;
  INSERT INTO face_platform.spending_events(target,action,actor,proof) VALUES(i.id::text,'payment.authorized',NEW.payer,jsonb_build_object('payloadHash',NEW.payload_hash,'authorizationNonce',NEW.authorization_nonce,'boundary','before-facilitator-settlement'));
 END IF;
 RETURN NEW;
END;$$;
CREATE OR REPLACE TRIGGER payment_spending_guard BEFORE INSERT OR UPDATE ON face_platform.payment_receipts FOR EACH ROW EXECUTE FUNCTION face_platform.guard_payment_spending();
INSERT INTO face_platform.schema_migrations(version) VALUES(7) ON CONFLICT DO NOTHING;
