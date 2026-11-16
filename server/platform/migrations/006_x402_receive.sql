CREATE TABLE IF NOT EXISTS face_platform.payment_quotes(
 id uuid PRIMARY KEY,space_id text NOT NULL,resource_url text NOT NULL,requirements jsonb NOT NULL,expires_at timestamptz NOT NULL,created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS face_platform.payment_receipts(
 id uuid PRIMARY KEY REFERENCES face_platform.payment_quotes(id),network text NOT NULL,asset text NOT NULL,amount numeric(78,0) NOT NULL CHECK(amount>0),receiver text NOT NULL,payer text NOT NULL,
 authorization_nonce text NOT NULL,payload_hash text NOT NULL,authorization_data jsonb NOT NULL,state text NOT NULL DEFAULT 'verifying' CHECK(state IN('verifying','preparing','settling','settlement_unknown','settled','delivered','failed')),
 settlement jsonb,transaction_hash text,chain_evidence jsonb,response_data jsonb,response_hash text,error_code text,created_at timestamptz NOT NULL DEFAULT now(),updated_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(network,asset,payer,authorization_nonce)
);
CREATE INDEX IF NOT EXISTS payment_receipts_payer ON face_platform.payment_receipts(payer,created_at DESC);
CREATE TABLE IF NOT EXISTS face_platform.payment_events(id bigserial PRIMARY KEY,receipt_id uuid NOT NULL REFERENCES face_platform.payment_receipts(id),previous_state text,next_state text NOT NULL,details jsonb NOT NULL DEFAULT '{}',created_at timestamptz NOT NULL DEFAULT now());
CREATE OR REPLACE FUNCTION face_platform.transition_payment(p_id uuid,p_expected text,p_next text,p_patch jsonb)
RETURNS jsonb LANGUAGE plpgsql AS $$
DECLARE r face_platform.payment_receipts%ROWTYPE;
BEGIN
 SELECT * INTO r FROM face_platform.payment_receipts WHERE id=p_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'FACE_PAYMENT_STATE';END IF;
 IF r.state=p_next OR (p_next='settled' AND r.state='delivered') THEN RETURN to_jsonb(r);END IF;
 IF r.state<>p_expected THEN RAISE EXCEPTION 'FACE_PAYMENT_STATE';END IF;
 IF NOT ((p_expected='verifying' AND p_next IN('preparing','failed')) OR(p_expected='preparing' AND p_next IN('settling','failed')) OR(p_expected='settling' AND p_next IN('settled','settlement_unknown')) OR(p_expected='settlement_unknown' AND p_next IN('settled','failed')) OR(p_expected='settled' AND p_next='delivered')) THEN RAISE EXCEPTION 'FACE_PAYMENT_TRANSITION';END IF;
 UPDATE face_platform.payment_receipts SET state=p_next,settlement=coalesce(p_patch->'settlement',settlement),transaction_hash=coalesce(p_patch->>'transactionHash',transaction_hash),chain_evidence=coalesce(p_patch->'chainEvidence',chain_evidence),response_data=coalesce(p_patch->'response',response_data),response_hash=coalesce(p_patch->>'responseHash',response_hash),error_code=coalesce(p_patch->>'errorCode',error_code),updated_at=now() WHERE id=p_id RETURNING * INTO r;
 INSERT INTO face_platform.payment_events(receipt_id,previous_state,next_state,details) VALUES(p_id,p_expected,p_next,p_patch-'response');
 RETURN to_jsonb(r);
END;$$;
INSERT INTO face_platform.schema_migrations(version) VALUES(6) ON CONFLICT DO NOTHING;
