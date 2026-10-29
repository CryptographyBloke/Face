import test from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";
import { Store } from "../server/store.mjs";
import { createApi } from "../server/app.mjs";
import { createNodeHandler } from "../server/http.mjs";
test("HTTP SPA deep links and complete signed claim → resolve → hide workflow", async () => {
  const dir = mkdtempSync(join(tmpdir(), "face-http-test-"));
  writeFileSync(join(dir, "index.html"), "<title>Wallet Face fixture</title>");
  const store = new Store();
  const origin = "http://localhost:5173";
  const account = privateKeyToAccount(generatePrivateKey());
  const api = createApi({
    store,
    origin,
    snapshot: { user: async () => null },
  });
  const server = createServer(createNodeHandler(api, { root: dir }));
  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  const base = "http://127.0.0.1:" + server.address().port;
  try {
    const deep = await fetch(base + "/spaces/yam.eth");
    assert.equal(deep.status, 200);
    assert.match(await deep.text(), /Wallet Face fixture/);
    const post = (path, body) =>
      fetch(base + path, {
        method: "POST",
        headers: { Origin: origin, "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
    const sign = async (action, payload) => {
      const r = await post("/v1/challenge", {
        address: account.address,
        action,
        payload,
      });
      assert.equal(r.status, 200);
      const c = await r.json();
      const signature = await account.signTypedData({
        ...c.typedData,
        message: {
          ...c.typedData.message,
          expiresAt: BigInt(c.typedData.message.expiresAt),
        },
      });
      return {
        nonce: c.typedData.message.nonce,
        signature,
        payload: c.payload,
      };
    };
    const b = await sign("profile.upsert", {
      name: "HTTP test fixture",
      bio: "",
      avatarURI: "",
      links: [],
      revision: 0,
    });
    assert.equal((await post("/v1/execute", b)).status, 200);
    const result = await (
      await fetch(base + "/v1/profile/1/" + account.address)
    ).json();
    assert.equal(result.provenance.profileClaimVerified, true);
    assert.equal(result.profile.name, "HTTP test fixture");
    assert.equal((await post("/v1/execute", b)).status, 409);
    const hide = await sign("profile.hide", { revision: 1 });
    assert.equal((await post("/v1/execute", hide)).status, 200);
    const hidden = await (
      await fetch(base + "/v1/profile/1/" + account.address)
    ).json();
    assert.equal(hidden.provenance.profileClaimVerified, false);
  } finally {
    await new Promise((r) => server.close(r));
    store.close();
    rmSync(dir, { recursive: true, force: true });
  }
});
