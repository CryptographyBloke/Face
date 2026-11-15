import { z } from 'zod';
import { wallet,uuid } from '../personal/schemas.mjs';
import { NETWORK,ASSET } from '../payments/protocol.mjs';
const amount=z.string().regex(/^[1-9]\d{0,77}$/).refine(v=>BigInt(v)<2n**256n);
export const spendingSchemas={
 'spend.policy.create':z.object({id:uuid,linkId:uuid,agentWallet:wallet,network:z.literal(NETWORK),asset:z.literal(ASSET),maxPerTransaction:amount,dailyLimit:amount,totalLimit:amount,recipients:z.array(wallet).min(1).max(10),expiresAt:z.number().int().positive()}).strict().refine(v=>BigInt(v.maxPerTransaction)<=BigInt(v.dailyLimit)&&BigInt(v.dailyLimit)<=BigInt(v.totalLimit),{message:'Per-transaction, daily and total limits must be ordered'}),
 'spend.policy.revoke':z.object({id:uuid,revision:z.number().int().positive()}).strict(),
 'spend.intent.approve':z.object({id:uuid,policyId:uuid,policyRevision:z.number().int().positive()}).strict(),
 'spend.intent.cancel':z.object({id:uuid,revision:z.number().int().positive()}).strict(),
};
