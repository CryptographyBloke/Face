import test from "node:test";
import assert from "node:assert/strict";
import { privateKeyToAccount } from "viem/accounts";
import { Store } from "../server/store.mjs";
import { Snapshot } from "../server/snapshot.mjs";
import { createApi } from "../server/app.mjs";
import { address, avatarUrls } from "../server/validation.mjs";
import { resolveProfile } from "../server/resolver.mjs";

const alice = privateKeyToAccount("0x" + "11".repeat(32));
const bob = privateKeyToAccount("0x" + "22".repeat(32));
const origin = "http://localhost:5173";
const payload = {
  name: "Alice",
  bio: "Public profile",
  avatarURI: "ipfs://QmTestImage",
  links: ["https://example.com/"],
  revision: 0,
};
function setup() {
  const store = new Store();
  const state = { admins: [alice.address], queries: 0 };
  const snapshot = {
    async user() {
      return {
        name: "Snapshot Alice",
        avatar: "ipfs://QmSnapshotImage",
        about: "",
      };
    },
    async space() {
      state.queries++;
      return { id: "test.eth", admins: state.admins };
    },
    async directory() {
      return {
        space: { id: "test.eth", name: "Test", admins: state.admins },
        participants: [{ address: alice.address, publicVotes: 2 }],
        proposals: [],
        activity: [],
        provenance: { source: "snapshot" },
      };
    },
  };
  const api = createApi({ snapshot, store, origin });
  return { store, state, snapshot, api };
}
async function call(api, path, body, requestOrigin = origin) {
  return api(
    new Request(origin + path, {
      method: body ? "POST" : "GET",
      headers: { origin: requestOrigin, "Content-Type": "application/json" },
      ...(body ? { body: JSON.stringify(body) } : {}),
    }),
  );
}
async function signed(
  env,
  action,
  input = payload,
  account = alice,
  forAddress = account.address,
) {
  const r = await call(env.api, "/v1/challenge", {
    address: forAddress,
    action,
    payload: input,
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
  return { nonce: c.typedData.message.nonce, signature, payload: c.payload };
}
test("address validation, normalization and safe image URL policy", () => {
  assert.equal(address(alice.address.toLowerCase()), alice.address);
  for (const value of ["0x123", "../../etc/passwd", "0x" + "z".repeat(40)])
    assert.throws(() => address(value));
  assert.equal(avatarUrls("ipfs://QmImage").length, 3);
  for (const uri of [
    "javascript:alert(1)",
    "data:image/svg+xml,x",
    "http://localhost/a",
    "ipfs://CID/../secret",
    "https://user:pass@example.com",
  ])
    assert.deepEqual(avatarUrls(uri), []);
});
test("profile signature, replay protection, optimistic update, visibility", async () => {
  const e = setup();
  try {
    const b = await signed(e, "profile.upsert");
    assert.equal((await call(e.api, "/v1/execute", b)).status, 200);
    const p = await (
      await call(e.api, "/v1/profile/1/" + alice.address)
    ).json();
    assert.equal(p.profile.name, "Alice");
    assert.equal(p.provenance.profileClaimVerified, true);
    assert.equal(p.profile.revision, 1);
    assert.equal(p.avatar.source, "face");
    assert.equal((await call(e.api, "/v1/execute", b)).status, 409);
    const stale = await signed(e, "profile.upsert");
    assert.equal((await call(e.api, "/v1/execute", stale)).status, 409);
    const hide = await signed(e, "profile.hide", { revision: 1 });
    assert.equal((await call(e.api, "/v1/execute", hide)).status, 200);
    const hidden = await (
      await call(e.api, "/v1/profile/1/" + alice.address)
    ).json();
    assert.equal(hidden.provenance.profileClaimVerified, false);
    assert.equal(hidden.profile.name, "Snapshot Alice");
    assert.equal(hidden.profile.revision, 2);
  } finally {
    e.store.close();
  }
});
test("rejects impersonation, payload substitution, expired nonce and wrong origin", async () => {
  const e = setup();
  try {
    const forged = await signed(
      e,
      "profile.upsert",
      payload,
      bob,
      alice.address,
    );
    assert.equal((await call(e.api, "/v1/execute", forged)).status, 403);
    const b = await signed(e, "profile.upsert");
    assert.equal(
      (
        await call(e.api, "/v1/execute", {
          ...b,
          payload: { ...payload, name: "Mallory" },
        })
      ).status,
      403,
    );
    assert.equal(
      (await call(e.api, "/v1/execute", b, "https://evil.example")).status,
      403,
    );
    const c = e.store.getChallenge(b.nonce);
    c.message.expiresAt = 1;
    e.store.db
      .prepare("UPDATE challenges SET data=? WHERE nonce=?")
      .run(JSON.stringify(c), b.nonce);
    assert.equal((await call(e.api, "/v1/execute", b)).status, 409);
  } finally {
    e.store.close();
  }
});
test("fresh organization authorization, role/badge issue and revocation", async () => {
  const e = setup();
  try {
    const brand = { spaceId: "test.eth", name: "Official Test", about: "" };
    const bad = await signed(e, "space.brand", brand, bob);
    assert.equal((await call(e.api, "/v1/execute", bad)).status, 403);
    const good = await signed(e, "space.brand", brand);
    assert.equal((await call(e.api, "/v1/execute", good)).status, 200);
    const issue = await signed(e, "badge.issue", {
      spaceId: "test.eth",
      recipient: bob.address,
      type: "Contributor",
      evidence: "Reviewed public submission",
      expiresAt: null,
    });
    const r = await call(e.api, "/v1/execute", issue);
    assert.equal(r.status, 200);
    const { id } = await r.json();
    assert.equal(e.store.get("badge", id).issuer, alice.address);
    const revoke = await signed(e, "badge.revoke", { spaceId: "test.eth", id });
    assert.equal((await call(e.api, "/v1/execute", revoke)).status, 200);
    assert.ok(e.store.get("badge", id).revokedAt);
    const role = await signed(e, "role.set", {
      spaceId: "test.eth",
      recipient: bob.address,
      role: "Reviewer",
    });
    assert.equal((await call(e.api, "/v1/execute", role)).status, 200);
    e.state.admins = [];
    const lost = await signed(e, "space.brand", brand);
    assert.equal((await call(e.api, "/v1/execute", lost)).status, 403);
    assert.equal(e.state.queries, 6);
    const mirror = await (await call(e.api, "/v1/spaces/test.eth")).json();
    assert.equal(mirror.official, false);
  } finally {
    e.store.close();
  }
});
test("public voters are never automatically admitted members", async () => {
  const e = setup();
  try {
    const d = await (await call(e.api, "/v1/spaces/test.eth/members")).json();
    assert.equal(d.kind, "public_governance_participants");
    assert.equal(d.items[0].profileClaimed, false);
    assert.deepEqual(d.items[0].roles, []);
    assert.deepEqual(d.items[0].badges, []);
  } finally {
    e.store.close();
  }
});
test("resolver source precedence and upstream degradation", async () => {
  const e = setup();
  try {
    let p = await resolveProfile(
      {
        ...e,
        ens: async () => ({ name: "alice.eth", avatar: "ipfs://QmEns" }),
      },
      1,
      alice.address,
    );
    assert.equal(p.avatar.source, "snapshot");
    p = await resolveProfile(
      {
        store: e.store,
        snapshot: {
          user: async () => {
            throw Error("offline");
          },
        },
        ens: async () => ({ name: "alice.eth", avatar: "ipfs://QmEns" }),
      },
      1,
      alice.address,
    );
    assert.equal(p.avatar.source, "ens");
    assert.equal(p.provenance.warnings.length, 1);
    await assert.rejects(
      () => resolveProfile(e, 10, alice.address),
      /chainId 1/,
    );
  } finally {
    e.store.close();
  }
});
test("API limits, CORS, unsupported chains, read-only mode and invalid payloads", async () => {
  const e = setup();
  try {
    assert.equal(
      (await call(e.api, "/v1/profile/1/not-an-address")).status,
      400,
    );
    assert.equal(
      (await call(e.api, "/v1/profile/10/" + alice.address)).status,
      422,
    );
    assert.equal(
      (
        await call(e.api, "/v1/challenge", {
          address: alice.address,
          action: "profile.upsert",
          payload: { ...payload, links: ["javascript:alert(1)"] },
        })
      ).status,
      400,
    );
    const readonly = createApi({ snapshot: e.snapshot, origin });
    assert.equal(
      (
        await call(readonly, "/v1/challenge", {
          address: alice.address,
          action: "profile.upsert",
          payload,
        })
      ).status,
      503,
    );
    const limited = createApi({ snapshot: e.snapshot, rateLimit: 1 });
    assert.equal((await call(limited, "/health")).status, 200);
    assert.equal((await call(limited, "/health")).status, 429);
  } finally {
    e.store.close();
  }
});
test("Snapshot pagination, deduplication, privacy omission, cutoffs and caching", async () => {
  const calls = [];
  const votes = [
    {
      id: "1",
      voter: alice.address,
      created: 10,
      vp: 1,
      proposal: { id: "p", title: "P", privacy: "" },
    },
    {
      id: "1",
      voter: alice.address.toLowerCase(),
      created: 10,
      vp: 1,
      proposal: { id: "p", title: "P", privacy: "" },
    },
    {
      id: "2",
      voter: bob.address,
      created: 9,
      vp: 1,
      proposal: { id: "p2", title: "Hidden", privacy: "shutter" },
    },
    {
      id: "3",
      voter: alice.address.toLowerCase(),
      created: 8,
      vp: 1,
      proposal: { id: "p", title: "P", privacy: "" },
    },
  ];
  const snapshot = new Snapshot({
    spacingMs: 0,
    pageSize: 2,
    maxVotes: 6,
    maxProposals: 4,
    sleep: async () => {},
    fetchImpl: async (_, options) => {
      const { query, variables: v } = JSON.parse(options.body);
      calls.push(v);
      let data;
      if (query.includes("space(id:"))
        data = {
          space: {
            id: "test.eth",
            name: "Test",
            about: "",
            network: "1",
            avatar: null,
            admins: [],
          },
        };
      else if (query.includes("proposals(first:")) data = { proposals: [] };
      else data = { votes: votes.slice(v.skip, v.skip + v.first) };
      return Response.json({ data });
    },
  });
  const d = await snapshot.directory("test.eth");
  assert.equal(d.participants.length, 1);
  assert.equal(d.participants[0].publicVotes, 2);
  assert.equal(d.activity.length, 2);
  assert.equal(d.provenance.votesComplete, true);
  assert.ok(calls.some((c) => c.skip === 2));
  assert.ok(calls.some((c) => c.cutoff));
  const count = calls.length;
  await snapshot.directory("test.eth");
  assert.equal(calls.length, count);
});
test("Snapshot bounded retries on throttling, timeouts and errors", async () => {
  let attempts = 0;
  const s = new Snapshot({
    spacingMs: 0,
    sleep: async () => {},
    fetchImpl: async () => {
      attempts++;
      return new Response("", { status: 429 });
    },
  });
  await assert.rejects(() => s.user(alice.address), /429/);
  assert.equal(attempts, 3);
  const offline = new Snapshot({
    spacingMs: 0,
    sleep: async () => {},
    fetchImpl: async () => {
      throw Error("offline");
    },
  });
  await assert.rejects(() => offline.space("test.eth"), /unavailable/);
});
