import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
test("legacy and www redirects are scoped to exact hosts and preserve deep paths",()=>{
  const config=JSON.parse(readFileSync(new URL("../vercel.json",import.meta.url),"utf8"));
  assert.equal(config.redirects.length,3);
  const daoRule=config.redirects.find(r=>r.has?.[0]?.value==="dao.sarl");
  const wwwRules=config.redirects.filter(r=>r.has?.[0]?.value==="www.walletface.org");
  assert.equal(daoRule.source,"/:path*");
  assert.equal(daoRule.destination,"https://walletface.org/:path*");
  assert.equal(daoRule.permanent,true);
  assert.deepEqual(wwwRules.map(r=>[r.source,r.destination,r.permanent]),[
    ["/:path*","https://walletface.org/:path*",true],
    ["/","https://walletface.org/",true]
  ]);
  assert.ok(config.rewrites.some(r=>r.source==="/avatar"));
  assert.ok(config.rewrites.some(r=>r.source==="/followed"));
});
