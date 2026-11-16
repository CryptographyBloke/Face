import {useEffect,useState} from 'react';
import {Link} from 'react-router-dom';
import {usePreferences} from '../app/Preferences';
import {useWallet} from '../app/WalletProvider';
import {SignedAction,WalletSession,usePlatformSession} from './client';
import './platform.css';
const network='eip155:84532',asset='0x036CbD53842c5426634e7929541eC2318f3dCF7e';
type Policy={id:string;owner:string;agent_wallet:string;max_per_transaction:string;daily_limit:string;total_limit:string;authorized_today:string;authorized_total:string;revision:number;revoked:boolean;expires_at:string};
type Intent={id:string;owner:string;amount:string;state:string;revision:number;space_id:string;expires_at:string;payment_state?:string;transaction_hash?:string};
async function read<T>(path:string,token:string){const r=await fetch('/v1/spending/'+path,{headers:{Authorization:'Bearer '+token}}),d=await r.json();if(!r.ok)throw Error(d.error?.message||'Spending unavailable');return d as T;}
export default function Spending(){
 const {t}=usePreferences(),{wallet}=useWallet(),{token}=usePlatformSession();
 const [enabled,setEnabled]=useState(false),[error,setError]=useState(''),[revision,setRevision]=useState(0),[policies,setPolicies]=useState<Policy[]>([]),[intents,setIntents]=useState<Intent[]>([]);
 const [id,setId]=useState(()=>crypto.randomUUID()),[link,setLink]=useState(''),[controller,setController]=useState(''),[recipient,setRecipient]=useState(''),[per,setPer]=useState('1000'),[daily,setDaily]=useState('3000'),[total,setTotal]=useState('10000'),[hours,setHours]=useState('24'),[expires,setExpires]=useState(()=>Math.floor(Date.now()/1000)+86400),[policyId,setPolicyId]=useState(''),[quoteId,setQuoteId]=useState('');
 const own=(a:string)=>wallet?.address.toLowerCase()===a,done=()=>setRevision(v=>v+1),selected=policies.find(p=>p.id===policyId);
 useEffect(()=>{let active=true;fetch('/v1/spending/status').then(r=>r.json()).then(d=>{if(active)setEnabled(d.enabled===true);}).catch(e=>{if(active)setError(e.message);});return()=>{active=false;};},[]);
 useEffect(()=>{let active=true;setPolicies([]);setIntents([]);setError('');if(token&&enabled)Promise.all([read<{items:Policy[]}>('policies',token),read<{items:Intent[]}>('intents',token)]).then(([p,i])=>{if(active){setPolicies(p.items);setIntents(i.items);}}).catch(e=>{if(active)setError(e.message);});return()=>{active=false;};},[token,enabled,revision]);
 return <section className="platform-page">
 <header className="page-heading"><div><p className="eyebrow">HUMAN-REVIEWED · TESTNET</p><h1>{t('Agent 支出限额与审批','Agent spending limits and approvals')}</h1><p>{t('所有者逐笔批准报价，独立 Agent 钱包再确认短期付款签名。','The owner approves each quote, then a separate Agent wallet confirms a short-lived payment signature.')}</p></div><Link to="/payments">{t('测试网支付','Testnet payments')} →</Link></header>
 <div className="panel"><p>{enabled?t('受控支出测试网可用','Controlled spending testnet enabled'):t('受控支出等待配置','Controlled spending awaits configuration')}</p><p>{t('限额覆盖 Wallet Face 付款授权流程。外部通用签名由钱包管理；自动签名关闭。','Limits cover Wallet Face payment authorization. Your wallet manages general external signing; automated signing is disabled.')}</p><p>{t('每日与累计限额计入已批准金额，待处理、失败或取消均保留预算预留。','Daily and total limits count approved amounts; pending, failed and cancelled approvals retain their reservation.')}</p><WalletSession/></div>
 {error&&<p role="alert">{error}</p>}
 <div className="panel form"><h2>{t('创建限额策略','Create spending policy')}</h2><Link to="/my-agents">{t('先完成所有者与独立控制钱包的关联','First link the owner and separate controller wallet')} →</Link>
 <label>{t('有效关联 ID','Active association ID')}<input value={link} onChange={e=>setLink(e.target.value)}/></label>
 <label>{t('Agent 控制钱包','Agent controller wallet')}<input value={controller} onChange={e=>setController(e.target.value)}/></label><p className="break-address">{network} · {asset}</p>
 <label>{t('允许的收款钱包','Allowed receiving wallet')}<input value={recipient} onChange={e=>setRecipient(e.target.value)}/></label>
 <label>{t('每笔上限（USDC 最小单位）','Per-payment cap (atomic USDC)')}<input inputMode="numeric" value={per} onChange={e=>setPer(e.target.value)}/></label>
 <label>{t('UTC 每日上限','UTC daily cap')}<input inputMode="numeric" value={daily} onChange={e=>setDaily(e.target.value)}/></label>
 <label>{t('累计上限','Total cap')}<input inputMode="numeric" value={total} onChange={e=>setTotal(e.target.value)}/></label>
 <label>{t('有效小时数（最多 720）','Validity in hours (max 720)')}<input inputMode="numeric" value={hours} onChange={e=>{setHours(e.target.value);setExpires(Math.floor(Date.now()/1000)+Number(e.target.value)*3600);}}/></label>
 <SignedAction action="spend.policy.create" payload={{id,linkId:link,agentWallet:controller,network,asset,maxPerTransaction:per,dailyLimit:daily,totalLimit:total,recipients:[recipient],expiresAt:expires}} disabled={!enabled||!link||!controller||!recipient} onDone={()=>{setId(crypto.randomUUID());done();}}>{t('所有者审核并签名限额','Owner: review and sign limits')}</SignedAction></div>
 <div className="panel form"><h2>{t('逐笔批准报价','Approve an individual quote')}</h2><label>{t('策略 ID','Policy ID')}<select value={policyId} onChange={e=>setPolicyId(e.target.value)}><option value="">{t('选择所有者策略','Select owner policy')}</option>{policies.filter(p=>own(p.owner)&&!p.revoked).map(p=><option key={p.id} value={p.id}>{p.id}</option>)}</select></label>
 <label>{t('待批准报价 ID','Quote ID to approve')}<input value={quoteId} onChange={e=>setQuoteId(e.target.value)}/></label>
 <SignedAction action="spend.intent.approve" payload={{id:quoteId,policyId,policyRevision:selected?.revision||1}} disabled={!enabled||!selected||!quoteId} onDone={done}>{t('审核确切收款方、服务和金额后签名','Review exact receiver, service and amount, then sign')}</SignedAction></div>
 {policies.map(p=><article className="panel" key={p.id}><h2>{t('策略','Policy')} {p.id}</h2><p>{p.revoked?t('已撤销','Revoked'):t('生效至','Expires')} {p.expires_at}</p><p className="break-address">{p.agent_wallet}</p><p>{t('每笔 / 每日 / 累计上限','Per-payment / daily / total caps')}: {p.max_per_transaction} / {p.daily_limit} / {p.total_limit}</p><p>{t('今日 / 累计批准金额','Approved today / total')}: {p.authorized_today} / {p.authorized_total}</p>{own(p.owner)&&!p.revoked&&<SignedAction action="spend.policy.revoke" payload={{id:p.id,revision:p.revision}} onDone={done}>{t('签名撤销后续支出权限','Sign revocation of future spending')}</SignedAction>}</article>)}
 {intents.map(i=><article className="panel" key={i.id}><h2>{t('付款审批','Payment approval')} {i.id}</h2><p>{i.amount} atomic USDC · {i.state} · {i.payment_state||t('尚未付款','Not submitted')} · {i.expires_at}</p><Link to={'/payments?spaceId='+encodeURIComponent(i.space_id)+'&requestId='+i.id}>{t('Agent 钱包打开此报价','Agent wallet: open this offer')} →</Link>{own(i.owner)&&i.state==='approved'&&<SignedAction action="spend.intent.cancel" payload={{id:i.id,revision:i.revision}} onDone={done}>{t('签名取消此审批','Sign cancellation of this approval')}</SignedAction>}{i.transaction_hash&&<a href={'https://sepolia.basescan.org/tx/'+i.transaction_hash} target="_blank" rel="noreferrer">{t('查看交易','View transaction')}</a>}</article>)}
 </section>;
}
