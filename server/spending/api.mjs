import { z } from 'zod';
import { SpendingRepository,spendingEnabled } from './service.mjs';
import { sessionActor } from '../platform/authorization.mjs';
import { ApiError,address } from '../validation.mjs';
export function createSpendingApi({origin,env=process.env,repository}={}){
 let repo=repository;
 return async request=>{const u=new URL(request.url),path=u.pathname.replace('/v1/spending/',''),json=(d,s=200)=>Response.json(d,{status:s,headers:{'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});
 try{if(request.method!=='GET')throw new ApiError(405,'METHOD','Use GET');if(path==='status')return json({enabled:spendingEnabled(env),mode:'human-reviewed-testnet',automatedSigning:false,ap2Compliant:false});if(!spendingEnabled(env))throw new ApiError(503,'SPENDING_DISABLED','Controlled spending is disabled');repo||=new SpendingRepository(env);
 if(path==='permit'){const p=z.object({quoteId:z.string().uuid(),payer:z.string().regex(/^0x[0-9a-fA-F]{40}$/)}).strict().parse(Object.fromEntries(u.searchParams));return json(await repo.permit(p.quoteId,address(p.payer).toLowerCase()));}
 const actor=sessionActor(request,origin,env);if(path==='policies')return json({items:await repo.policies(actor)});if(path==='intents')return json({items:await repo.intents(actor)});throw new ApiError(404,'NOT_FOUND','Spending route not found');
 }catch(e){const bad=e instanceof z.ZodError;return json({error:{code:bad?'INPUT':e.code||'SPENDING_UNAVAILABLE',message:bad?'Invalid spending input':e instanceof ApiError?e.message:'Spending service unavailable'}},bad?400:e instanceof ApiError?e.status:503);}};
}
