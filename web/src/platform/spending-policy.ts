import type { PaymentRequirements } from '@x402/core/types';
export type SigningPermit={managed:boolean;allowed:boolean;humanApprovalRequired:boolean;quoteId?:string;payer?:string;requirements?:PaymentRequirements;resourceUrl?:string;expiresAt?:number;approvalHash?:string;reason?:string};
/** Runs inside the official SDK signing callback, immediately before wallet invocation. */
export function assertSigningPermit(permit:SigningPermit,quoteId:string,payer:string,requirements:PaymentRequirements,resourceUrl:string,validBefore:bigint){
 if(!permit.allowed||!permit.humanApprovalRequired)throw Error('Owner approval is required or revoked');
 if(!permit.managed)return;
 const r=permit.requirements;
 if(!r||permit.quoteId!==quoteId||permit.payer?.toLowerCase()!==payer.toLowerCase()||permit.resourceUrl!==resourceUrl||permit.expiresAt===undefined||validBefore>BigInt(permit.expiresAt)||!permit.approvalHash||r.network!==requirements.network||r.asset.toLowerCase()!==requirements.asset.toLowerCase()||r.amount!==requirements.amount||r.payTo.toLowerCase()!==requirements.payTo.toLowerCase())throw Error('Spending approval does not authorize this exact payment or expiry');
}
