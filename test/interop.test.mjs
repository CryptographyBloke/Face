import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { privateKeyToAccount, generatePrivateKey } from "viem/accounts";
import { createMcpHandler } from "@modelcontextprotocol/server";
import { mcpServer } from "../server/mcp/server.mjs";
import {
  probeMcp,
  probeA2a,
  pinnedMcpFetch,
} from "../server/interop/probe.mjs";
import { InteropService } from "../server/interop/service.mjs";
const owner = privateKeyToAccount(generatePrivateKey()),
  other = privateKeyToAccount(generatePrivateKey()),
  actor = owner.address.toLowerCase();
const card = {
  name: "Fixture Agent",
  description: "Controlled metadata fixture",
  version: "1.0.0",
  supportedInterfaces: [
    {
      url: "https://owned.example/a2a",
      protocolBinding: "JSONRPC",
      protocolVersion: "1.0",
    },
  ],
  capabilities: { streaming: true },
  defaultInputModes: ["text/plain"],
  defaultOutputModes: ["text/plain"],
  skills: [
    {
      id: "research",
      name: "Research",
      description: "Self-declared research",
      tags: ["governance"],
    },
  ],
};
test("A2A v1 metadata is bounded and kept as operator declarations, with signatures and execution separate", async () => {
  const result = await probeA2a("https://owned.example/card", async () => card);
  assert.equal(result.status, "metadata_checked");
  assert.equal(result.taskExecution, false);
  assert.equal(result.signatureVerification, "not_checked");
  assert.equal(result.card.skills.length, 1);
  await assert.rejects(
    probeA2a("https://owned.example/card", async () => ({
      ...card,
      supportedInterfaces: [],
    })),
  );
  await assert.rejects(
    probeA2a("https://owned.example/card", async () => ({
      ...card,
      name: "x".repeat(101),
    })),
  );
  await assert.rejects(
    probeA2a("https://owned.example/card", async () => ({
      ...card,
      supportedInterfaces: [
        {
          url: "http://localhost",
          protocolBinding: "JSONRPC",
          protocolVersion: "1.0",
        },
      ],
    })),
  );
});
test("official MCP SDK discovers five read-only Wallet Face tools without invoking one", async () => {
  let executed = 0;
  const handler = createMcpHandler(() =>
    mcpServer({
      snapshot: {
        directory: async () => {
          executed++;
          throw Error("must not execute");
        },
      },
    }),
  );
  const result = await probeMcp("https://owned.example/mcp", {
    fetcher: (u, i) => handler.fetch(new Request(u, i)),
  });
  assert.equal(result.tools.length, 5);
  assert.equal(executed, 0);
  assert.equal(result.toolExecution, false);
  assert.ok(result.tools.some((t) => t.name === "verify_identity_claim"));
});
test("MCP transport rejects private DNS, credential URLs and all non-metadata methods before network requests", async () => {
  await assert.rejects(
    pinnedMcpFetch("http://127.0.0.1", { method: "POST", body: "{}" }),
    /public HTTPS/,
  );
  await assert.rejects(
    pinnedMcpFetch("https://user:secret@owned.example", {
      method: "POST",
      body: "{}",
    }),
    /public HTTPS/,
  );
  await assert.rejects(
    pinnedMcpFetch("https://owned.example", {
      method: "POST",
      body: JSON.stringify({
        method: "tools/call",
        params: { name: "transfer.send" },
      }),
    }),
    /metadata/,
  );
  await assert.rejects(
    pinnedMcpFetch(
      "https://owned.example",
      { method: "POST", body: JSON.stringify({ method: "tools/list" }) },
      { resolve: async () => [{ address: "127.0.0.1", family: 4 }] },
    ),
    /restricted/,
  );
  assert.equal(
    (await pinnedMcpFetch("https://owned.example", { method: "GET" })).status,
    405,
  );
});
function fixture() {
  const a = {
      id: randomUUID(),
      controller: actor,
      revision: 1,
      metadata: {
        endpoints: [{ protocol: "a2a", url: "https://owned.example/card" }],
      },
    },
    store = new Map();
  let writes = 0;
  const repository = {
    agent: async () => a,
    createChallenge: async (t, p) =>
      store.set(t.message.nonce, { payload: { typedData: t, payload: p } }),
    challenge: async (n) => store.get(n),
    applyDiscovery: async (n) => {
      store.get(n).used_at = 1;
      writes++;
      return { status: "metadata_checked" };
    },
  };
  const service = new InteropService({
    env: { FACE_INTEROP_ENABLED: "true" },
    origin: "https://walletface.test",
    repository,
    a2aProbe: async () => ({ protocol: "a2a", taskExecution: false }),
  });
  service.identity = async () => ({
    links: [
      {
        owner: actor,
        verification: { activeAssociation: true },
        endpoint_evidence: [
          { url: "https://owned.example", checkedAt: new Date().toISOString() },
        ],
      },
    ],
  });
  const sign = async (c, account = owner) => ({
    nonce: c.typedData.message.nonce,
    payload: c.payload,
    signature: await account.signTypedData(c.typedData),
  });
  return { service, a, sign, writes: () => writes };
}
test("only publisher-signed declared endpoints with recent domain control can be probed", async () => {
  const f = fixture(),
    p = { id: f.a.id, revision: 1, endpointUrl: "https://owned.example/card" };
  await assert.rejects(
    f.service.challenge(other.address.toLowerCase(), "agent.probe.a2a", p),
    /profile wallet/,
  );
  await assert.rejects(
    f.service.challenge(actor, "agent.probe.a2a", {
      ...p,
      endpointUrl: "https://other.example/card",
    }),
    /declared/,
  );
  const c = await f.service.challenge(actor, "agent.probe.a2a", p);
  await assert.rejects(
    f.service.execute(await f.sign(c, other)),
    /does not control/,
  );
  await f.service.execute(await f.sign(c));
  assert.equal(f.writes(), 1);
  await assert.rejects(f.service.execute(await f.sign(c)), /already used/);
  f.service.identity = async () => ({ links: [] });
  await assert.rejects(
    f.service.challenge(actor, "agent.probe.a2a", p),
    /domain-control/,
  );
});
test("discovery permission cannot override revocation, profile changes or execute remote tools", async () => {
  const f = fixture(),
    p = { id: f.a.id, revision: 1, endpointUrl: "https://owned.example/card" },
    c = await f.service.challenge(actor, "agent.probe.a2a", p);
  f.a.revision = 2;
  await assert.rejects(f.service.execute(await f.sign(c)), /Profile changed/);
  await assert.rejects(
    f.service.challenge(actor, "agent.tools.call", {}),
    /Unsupported/,
  );
  f.service.env.FACE_INTEROP_ENABLED = "false";
  await assert.rejects(
    f.service.challenge(actor, "agent.probe.a2a", { ...p, revision: 2 }),
    /disabled/,
  );
});

test("upstream discovery failures do not consume authorization or expose debug data", async () => {
  const f = fixture(),
    p = { id: f.a.id, revision: 1, endpointUrl: "https://owned.example/card" },
    c = await f.service.challenge(actor, "agent.probe.a2a", p);
  f.service.a2aProbe = async () => {
    throw Error("upstream-private-debug");
  };
  await assert.rejects(
    f.service.execute(await f.sign(c)),
    (e) => e.status === 502 && !e.message.includes("private-debug"),
  );
  assert.equal(f.writes(), 0);
});
