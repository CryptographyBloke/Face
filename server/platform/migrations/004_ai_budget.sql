CREATE OR REPLACE FUNCTION face_platform.reserve_budget(p_keys text[],p_limits bigint[],p_weights bigint[],p_expiry timestamptz) RETURNS boolean LANGUAGE plpgsql AS $$
DECLARE i integer; n bigint;
BEGIN
 PERFORM pg_advisory_xact_lock(hashtext('face_platform_ai_budget'));
 FOR i IN 1..array_length(p_keys,1) LOOP
  SELECT count INTO n FROM face_platform.quota_buckets WHERE key=p_keys[i] AND expires_at>now();
  IF coalesce(n,0)+p_weights[i]>p_limits[i] THEN RETURN false; END IF;
 END LOOP;
 FOR i IN 1..array_length(p_keys,1) LOOP
  INSERT INTO face_platform.quota_buckets(key,count,expires_at) VALUES(p_keys[i],p_weights[i],p_expiry)
  ON CONFLICT(key) DO UPDATE SET count=CASE WHEN face_platform.quota_buckets.expires_at<=now() THEN p_weights[i] ELSE face_platform.quota_buckets.count+p_weights[i] END,expires_at=p_expiry;
 END LOOP;
 RETURN true;
END;$$;
INSERT INTO face_platform.schema_migrations(version) VALUES(4) ON CONFLICT DO NOTHING;
