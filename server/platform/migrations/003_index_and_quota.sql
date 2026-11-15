ALTER TABLE face_platform.scan_jobs ADD COLUMN IF NOT EXISTS lease_token text;
CREATE OR REPLACE FUNCTION face_platform.reserve_quota(p_keys text[],p_limits bigint[],p_expiry timestamptz) RETURNS boolean LANGUAGE plpgsql AS $$
DECLARE k text; i integer; n bigint;
BEGIN
 PERFORM pg_advisory_xact_lock(hashtext('face_platform_quota'));
 FOR i IN 1..array_length(p_keys,1) LOOP
  SELECT count INTO n FROM face_platform.quota_buckets WHERE key=p_keys[i] AND expires_at>now();
  IF coalesce(n,0)>=p_limits[i] THEN RETURN false; END IF;
 END LOOP;
 FOREACH k IN ARRAY p_keys LOOP
  INSERT INTO face_platform.quota_buckets(key,count,expires_at) VALUES(k,1,p_expiry)
  ON CONFLICT(key) DO UPDATE SET count=CASE WHEN face_platform.quota_buckets.expires_at<=now() THEN 1 ELSE face_platform.quota_buckets.count+1 END,expires_at=p_expiry;
 END LOOP;
 RETURN true;
END;$$;
CREATE OR REPLACE FUNCTION face_platform.ingest_page(p_space text,p_lease text,p_proposals jsonb,p_votes jsonb,p_proposal_count integer,p_vote_count integer,p_pc boolean,p_vc boolean) RETURNS boolean LANGUAGE plpgsql AS $$
DECLARE j face_platform.scan_jobs%ROWTYPE;
BEGIN
 SELECT * INTO j FROM face_platform.scan_jobs WHERE space_id=p_space FOR UPDATE;
 IF NOT FOUND OR j.lease_token<>p_lease OR j.lease_until<=now() THEN RAISE EXCEPTION 'FACE_LEASE';END IF;
 INSERT INTO face_platform.proposals(space_id,id,title,created,privacy,metadata)
 SELECT p_space,x.id,x.title,x.created,x.privacy,'{}'::jsonb FROM jsonb_to_recordset(p_proposals) AS x(id text,title text,created bigint,privacy text)
 ON CONFLICT(space_id,id) DO UPDATE SET title=excluded.title,privacy=excluded.privacy,fetched_at=now();
 INSERT INTO face_platform.votes(space_id,id,voter,proposal_id,created,voting_power)
 SELECT p_space,x.id,lower(x.voter),x.proposal_id,x.created,x.voting_power FROM jsonb_to_recordset(p_votes) AS x(id text,voter text,proposal_id text,created bigint,voting_power numeric)
 ON CONFLICT(space_id,id) DO UPDATE SET fetched_at=now();
 UPDATE face_platform.scan_jobs SET proposal_offset=proposal_offset+p_proposal_count,vote_offset=vote_offset+p_vote_count,
 proposals_scanned=proposals_scanned+p_proposal_count,votes_scanned=votes_scanned+p_vote_count,
 proposals_complete=proposals_complete OR p_pc,votes_complete=votes_complete OR p_vc,
 status=CASE WHEN (proposals_complete OR p_pc) AND (votes_complete OR p_vc) THEN 'exhausted' ELSE 'partial' END,
 lease_until=NULL,lease_token=NULL,last_error=NULL,updated_at=now() WHERE space_id=p_space;
 RETURN true;
END;$$;
INSERT INTO face_platform.schema_migrations(version) VALUES(3) ON CONFLICT DO NOTHING;
