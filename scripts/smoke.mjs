import {Snapshot} from '../server/snapshot.mjs';
import {createApi} from '../server/app.mjs';
const api=createApi({snapshot:new Snapshot({maxVotes:20,maxProposals:5})});
for(const path of ['/health','/v1/spaces/yam.eth','/v1/spaces/yam.eth/members']){
  const r=await api(new Request('http://localhost'+path));const b=await r.json();
  console.log(JSON.stringify({path,status:r.status,space:b.space?.name,counts:b.counts,participantCount:b.items?.length,provenance:b.provenance}));
  if(!r.ok)process.exitCode=1;
}
