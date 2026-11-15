import { PersonalAgentService } from '../personal/service.mjs';
import { PersonalAgentRepository } from '../personal/repository.mjs';
import { makeAuthorization,verifyAuthorization,digest } from '../platform/authorization.mjs';
import { spendingSchemas } from './schemas.mjs';
import { ApiError } from '../validation.mjs';
import { NETWORK,ASSET } from '../payments/protocol.mjs';
export const spendingEnabled=env=>env.FACE_SPENDING_ENABLED==='true';
export class SpendingRepository extends PersonalAgentRepository{
 async policy(id,actor){return(await this.db.query('SELECT * FROM face_platform.spending_policies WHERE id=$1::uuid AND (owner=$2 OR agent_wallet=$2)',[id,actor]))[0]||null;}
 async intent(id,actor){return(await this.db.query('SELECT * FROM face_platform.spending_intents WHERE id=$1::uuid AND (owner=$2 OR agent_wallet=$2)',[id,actor]))[0]||null;}
 async quote(id){return(await this.db.query('SELECT * FROM face_platform.payment_quotes WHERE id=$1::uuid',[id]))[0]||null;}
 async policies(actor){return this.db.query("SELECT p.*,coalesce((SELECT sum(amount)::text FROM face_platform.spending_intents WHERE policy_id=p.id),'0') AS authorized_total,coalesce((SELECT sum(amount)::text FROM face_platform.spending_intents WHERE policy_id=p.id AND approved_at>=(date_trunc('day',now() AT TIME ZONE 'UTC') AT TIME ZONE 'UTC')),'0') AS authorized_today FROM face_platform.spending_policies p WHERE owner=$1 OR agent_wallet=$1 ORDER BY created_at DESC LIMIT 50",[actor]);}
 async intents(actor){return this.db.query('SELECT i.*,q.space_id,r.state AS payment_state,r.transaction_hash FROM face_platform.spending_intents i JOIN face_platform.payment_quotes q ON q.id=i.id LEFT JOIN face_platform.payment_receipts r ON r.id=i.id WHERE i.owner=$1 OR i.agent_wallet=$1 ORDER BY i.approved_at DESC LIMIT 50',[actor]);}
 async applySpending(nonce,actor,action,hash,origin,data,proof){try{return(await this.db.query('SELECT face_platform.apply_spending_change($1,$2,$3,$4,$5,$6::jsonb,$7::jsonb) AS result',[nonce,actor,action,hash,origin,JSON.stringify(data),JSON.stringify(proof)]))[0].result;}catch(e){if(/FACE_SPEND|duplicate key/.test(e.message))throw new ApiError(409,'SPENDING_LIMIT_OR_REVISION','Approval rejected: inspect limits, expiry, current association and duplicate/revoked records');throw e;}}
 async permit(id,payer){
  const known=await this.db.query('SELECT id FROM face_platform.spending_policies WHERE agent_wallet=$1 LIMIT 1',[payer]);
  if(!known.length)return{managed:false,allowed:true,humanApprovalRequired:true,scope:'manual-payment-only'};
  const rows=await this.db.query("SELECT i.*,p.revoked,p.expires_at AS policy_expiry,p.network,p.asset,p.recipients,q.requirements,q.resource_url,l.status AS link_status,l.controller,l.agent_revision,a.revision AS current_revision FROM face_platform.spending_intents i JOIN face_platform.spending_policies p ON p.id=i.policy_id JOIN face_platform.payment_quotes q ON q.id=i.id JOIN face_platform.agent_links l ON l.id=p.link_id JOIN face_platform.agents a ON a.id=l.agent_id WHERE i.id=$1::uuid AND i.agent_wallet=$2",[id,payer]);
  const r=rows[0],now=Date.now();
  if(!r||r.revoked||r.state!=='approved'||new Date(r.expires_at).getTime()<=now||new Date(r.policy_expiry).getTime()<=now||r.link_status!=='active'||r.agent_revision!==r.current_revision||r.controller!==payer||r.network!==NETWORK||r.asset!==ASSET.toLowerCase()||!r.recipients.includes(r.requirements.payTo.toLowerCase()))return{managed:true,allowed:false,humanApprovalRequired:true,reason:'OWNER_APPROVAL_REQUIRED_OR_REVOKED'};
  return{managed:true,allowed:true,humanApprovalRequired:true,quoteId:id,payer,requirements:r.requirements,resourceUrl:r.resource_url,expiresAt:Math.floor(new Date(r.expires_at).getTime()/1000),approvalHash:digest(r.approval_proof),scope:'walletface-fixed-testnet-report'};
 }
}
export class SpendingService extends PersonalAgentService{
 constructor(options){super({...options,repository:options.repository||new SpendingRepository(options.env)});}
 async spendingContext(action,p,actor){
  if(action==='spend.policy.create'){
   const l=await this.repository.link(p.linkId,actor);if(!l||l.owner!==actor||l.controller!==p.agentWallet.toLowerCase()||l.owner===l.controller)throw new ApiError(403,'SPENDING_AGENT_WALLET','Use an active association with a separate Agent controller wallet');
   const a={id:l.agent_id,controller:l.profile_controller,name:l.name,metadata:l.metadata,revision:l.profile_revision};if(!(await this.checkedLink(l,a)).verification.activeAssociation)throw new ApiError(403,'SPENDING_ASSOCIATION','Fresh owner/controller and endpoint evidence are required');
   const now=Math.floor(Date.now()/1000);if(p.expiresAt<=now||p.expiresAt>now+30*86400)throw new ApiError(422,'SPENDING_EXPIRY','Policy expiry must be within 30 days');
   return{...p,linkRevision:l.revision,profileRevision:a.revision,service:'walletface.governance-report/v1',humanApprovalRequired:true};
  }
  if(action==='spend.intent.cancel'){const i=await this.repository.intent(p.id,actor);if(!i||i.owner!==actor||i.revision!==p.revision||i.state!=='approved')throw new ApiError(403,'SPENDING_OWNER','Only the owner can cancel a pending approval');return{...p,policyId:i.policy_id,amount:String(i.amount),resourceUrl:i.resource_url};}
  const policy=await this.repository.policy(action==='spend.policy.revoke'?p.id:p.policyId,actor);
  if(!policy||policy.owner!==actor||policy.revoked||policy.revision!==(p.policyRevision||p.revision))throw new ApiError(403,'SPENDING_OWNER','Policy owner signature and current revision are required');
  if(action==='spend.policy.revoke')return{...p,agentWallet:policy.agent_wallet};
  const q=await this.repository.quote(p.id);if(!q||new Date(q.expires_at).getTime()<=Date.now()||new Date(policy.expires_at).getTime()<=Date.now()||!q.resource_url.startsWith(this.origin+'/v1/payments/report?'))throw new ApiError(422,'SPENDING_QUOTE','Use a current Wallet Face testnet quote');
  const req=q.requirements;if(req.network!==NETWORK||req.asset.toLowerCase()!==ASSET.toLowerCase()||!policy.recipients.includes(req.payTo.toLowerCase())||BigInt(req.amount)>BigInt(policy.max_per_transaction))throw new ApiError(403,'SPENDING_POLICY','Quote exceeds the approved network, asset, receiver or amount');
  return{...p,agentWallet:policy.agent_wallet,amount:req.amount,requirements:req,requirementsHash:digest(req),authorizationWindowSeconds:300,policyExpiresAt:Math.floor(new Date(policy.expires_at).getTime()/1000),quoteExpiresAt:Math.floor(new Date(q.expires_at).getTime()/1000),resourceUrl:q.resource_url,humanApprovalRequired:true};
 }
 async challenge(actor,action,input){if(!spendingSchemas[action])return super.challenge(actor,action,input);if(!spendingEnabled(this.env))throw new ApiError(503,'SPENDING_DISABLED','Controlled spending is disabled');actor=actor.toLowerCase();const p=spendingSchemas[action].parse(input),payload=await this.spendingContext(action,p,actor),typedData=makeAuthorization(this.origin,actor,action,payload);await this.repository.createChallenge(typedData,payload);return{typedData,payload};}
 async execute(input){const saved=await this.repository.challenge(input.nonce),action=saved?.payload?.typedData?.message?.action;if(!spendingSchemas[action])return super.execute(input);if(!spendingEnabled(this.env))throw new ApiError(503,'SPENDING_DISABLED','Controlled spending is disabled');if(saved.used_at)throw new ApiError(409,'REPLAY','Authorization was already used');const typed=saved.payload.typedData,actor=await verifyAuthorization(typed,input.signature,input.payload,this.origin);if(typed.message.nonce!==input.nonce||digest(saved.payload.payload)!==digest(input.payload))throw new ApiError(403,'PAYLOAD','Authorization content changed');const p=spendingSchemas[action].parse(Object.fromEntries(Object.keys(spendingSchemas[action].shape).map(k=>[k,input.payload[k]]))),current=await this.spendingContext(action,p,actor);if(digest(current)!==digest(input.payload))throw new ApiError(409,'SPENDING_CONTEXT','Policy or quote changed; review again');const proof={typedData:typed,signature:input.signature,signedPayload:input.payload,verifiedAt:new Date().toISOString()};return this.repository.applySpending(input.nonce,actor,action,typed.message.payloadHash,this.origin,current,proof);}
}
