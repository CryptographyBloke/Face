import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
test("legacy and www redirects are scoped to exact hosts and preserve deep paths",()=>{
  const config=JSON.parse(readFileSync(new URL("../vercel.json",import.meta.url),"utf8"));
  assert.equal(config.redirects.length,2);
  assert.deepEqual(config.redirects.map(r=>r.has),[
    [{type:"host",value:"dao.sarl"}],
    [{type:"host",value:"www.walletface.org"}]
  ]);
  for(const rule of config.redirects){
    assert.equal(rule.source,"/:path*");
    assert.equal(rule.destination,"https://walletface.org/:path*");
    assert.equal(rule.permanent,true);
  }
  assert.ok(config.rewrites.some(r=>r.source==="/avatar"));
  assert.ok(config.rewrites.some(r=>r.source==="/followed"));
});
