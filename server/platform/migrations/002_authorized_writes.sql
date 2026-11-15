CREATE OR REPLACE FUNCTION face_platform.apply_authorized_change(p_nonce text,p_actor text,p_action text,p_hash text,p_origin text,p_data jsonb,p_proof jsonb)
RETURNS jsonb LANGUAGE plpgsql AS $$
DECLARE c face_platform.challenges%ROWTYPE; a face_platform.actions%ROWTYPE; v_result jsonb; changed integer;
BEGIN
 SELECT * INTO c FROM face_platform.challenges WHERE nonce=p_nonce FOR UPDATE;
 IF NOT FOUND OR c.used_at IS NOT NULL OR c.expires_at<now() THEN RAISE EXCEPTION 'FACE_REPLAY'; END IF;
 IF c.actor<>p_actor OR c.action<>p_action OR c.payload_hash<>p_hash OR c.origin<>p_origin THEN RAISE EXCEPTION 'FACE_AUTHORIZATION'; END IF;
 IF p_action='session.create' THEN v_result=jsonb_build_object('ok',true);
 ELSIF p_action='agent.register' THEN
  INSERT INTO face_platform.agents(id,controller,name,metadata,published,proof) VALUES((p_data->>'id')::uuid,p_actor,p_data->>'name',p_data,p_data->>'published'='true',p_proof);
  v_result=jsonb_build_object('id',p_data->>'id','revision',1);
 ELSIF p_action='agent.update' OR p_action IN ('agent.verify.endpoint','agent.verify.registry') THEN
  UPDATE face_platform.agents SET name=p_data->>'name',metadata=p_data,published=p_data->>'published'='true',revision=revision+1,proof=p_proof,updated_at=now()
   WHERE id=(p_data->>'id')::uuid AND controller=p_actor AND revision=(p_data->>'revision')::integer;
  GET DIAGNOSTICS changed=ROW_COUNT;IF changed<>1 THEN RAISE EXCEPTION 'FACE_REVISION'; END IF;
  v_result=jsonb_build_object('id',p_data->>'id','revision',(p_data->>'revision')::integer+1);
 ELSIF p_action='report.save' THEN
  INSERT INTO face_platform.reports(id,owner,space_id,title,summary,evidence,public,proof) VALUES((p_data->>'id')::uuid,p_actor,p_data->>'spaceId',p_data->>'title',p_data->>'summary',p_data->'evidence',(p_data->>'public')::boolean,p_proof);
  v_result=jsonb_build_object('id',p_data->>'id','saved',true);
 ELSIF p_action='organization.configure' THEN
  IF (p_data->>'revision')::integer=0 THEN
   INSERT INTO face_platform.organizations(space_id,admin,name,config,proof) VALUES(p_data->>'spaceId',p_actor,p_data->>'name',p_data,p_proof);
  ELSE
   UPDATE face_platform.organizations SET admin=p_actor,name=p_data->>'name',config=p_data,proof=p_proof,revision=revision+1,updated_at=now() WHERE space_id=p_data->>'spaceId' AND revision=(p_data->>'revision')::integer;
   GET DIAGNOSTICS changed=ROW_COUNT;IF changed<>1 THEN RAISE EXCEPTION 'FACE_REVISION'; END IF;
  END IF;
  v_result=jsonb_build_object('spaceId',p_data->>'spaceId','revision',(p_data->>'revision')::integer+1);
 ELSIF p_action='action.prepare' THEN
  INSERT INTO face_platform.actions(id,owner,space_id,kind,content,content_hash,preparation_proof) VALUES((p_data->>'id')::uuid,p_actor,p_data->>'spaceId',p_data->>'kind',p_data->'content',p_data->>'contentHash',p_proof);
  v_result=jsonb_build_object('id',p_data->>'id','state','prepared','revision',1);
 ELSIF p_action IN ('action.approve','action.execute','action.cancel') THEN
  SELECT * INTO a FROM face_platform.actions WHERE id=(p_data->>'id')::uuid FOR UPDATE;
  IF NOT FOUND OR a.owner<>p_actor OR a.revision<>(p_data->>'revision')::integer OR a.content_hash<>p_data->>'contentHash' THEN RAISE EXCEPTION 'FACE_REVISION'; END IF;
  IF p_action='action.approve' THEN
   IF a.state<>'prepared' THEN RAISE EXCEPTION 'FACE_STATE'; END IF;
   UPDATE face_platform.actions SET state='approved',approval_proof=p_proof,revision=revision+1,updated_at=now() WHERE id=a.id;
   v_result=jsonb_build_object('id',a.id,'state','approved','revision',a.revision+1);
  ELSIF p_action='action.cancel' THEN
   IF a.state NOT IN ('prepared','approved') THEN RAISE EXCEPTION 'FACE_STATE'; END IF;
   UPDATE face_platform.actions SET state='cancelled',execution_proof=p_proof,revision=revision+1,updated_at=now() WHERE id=a.id;
   v_result=jsonb_build_object('id',a.id,'state','cancelled','revision',a.revision+1);
  ELSE
   IF a.state<>'approved' OR a.approval_proof IS NULL THEN RAISE EXCEPTION 'FACE_STATE'; END IF;
   IF a.kind='report.publish' THEN
    UPDATE face_platform.reports SET public=true WHERE id=(a.content->>'reportId')::uuid AND owner=p_actor AND space_id=a.space_id;
    GET DIAGNOSTICS changed=ROW_COUNT;IF changed<>1 THEN RAISE EXCEPTION 'FACE_RECORD'; END IF;
   ELSIF a.kind='badge.revoke' THEN
    UPDATE face_platform.organization_records SET revoked_at=now() WHERE id=a.content->>'badgeId' AND space_id=a.space_id AND kind='badge.issue' AND revoked_at IS NULL;
    GET DIAGNOSTICS changed=ROW_COUNT;IF changed<>1 THEN RAISE EXCEPTION 'FACE_RECORD'; END IF;
   ELSE
    INSERT INTO face_platform.organization_records(id,space_id,kind,issuer,value,proof) VALUES(
      CASE WHEN a.kind='role.set' THEN a.space_id||':role:'||lower(a.content->>'recipient') ELSE a.id::text END,
      a.space_id,a.kind,p_actor,a.content,jsonb_build_object('preparation',a.preparation_proof,'approval',a.approval_proof,'execution',p_proof))
     ON CONFLICT(id) DO UPDATE SET value=excluded.value,proof=excluded.proof,issuer=excluded.issuer,revoked_at=NULL,issued_at=now();
   END IF;
   v_result=jsonb_build_object('id',a.id,'state','executed','kind',a.kind,'revision',a.revision+1,'recordId',a.id);
   UPDATE face_platform.actions SET state='executed',execution_proof=p_proof,result=v_result,revision=revision+1,updated_at=now() WHERE id=a.id;
  END IF;
 ELSE RAISE EXCEPTION 'FACE_ACTION'; END IF;
 UPDATE face_platform.challenges SET used_at=now() WHERE nonce=p_nonce;
 INSERT INTO face_platform.audit_events(actor,action,target,payload_hash,proof,outcome) VALUES(p_actor,p_action,coalesce(p_data->>'id',p_data->>'spaceId',p_actor),p_hash,p_proof,'applied');
 RETURN v_result;
END;$$;
INSERT INTO face_platform.schema_migrations(version) VALUES(2) ON CONFLICT DO NOTHING;
