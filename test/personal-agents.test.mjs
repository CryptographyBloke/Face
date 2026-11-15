import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";
import {
  PersonalAgentService,
  historicalProof,
} from "../server/personal/service.mjs";
import { platformSchemas } from "../server/platform/schemas.mjs";
import {
  verifyRegistration,
  identityRegistries,
} from "../server/personal/registry.mjs";
const owner = privateKeyToAccount(generatePrivateKey()),
  controller = privateKeyToAccount(generatePrivateKey()),
  attacker = privateKeyToAccount(generatePrivateKey());
const address = (a) => a.address.toLowerCase(),
  origin = "https://walletface.test";
function fixture(remote = false) {
  const a = {
    id: randomUUID(),
    controller: address(owner),
    name: "Synthetic agent",
    revision: 1,
    published: true,
    metadata: {
      name: "Synthetic agent",
      agentController: address(controller),
      endpoints: remote
        ? [{ protocol: "https", url: "https://agent.example/api" }]
        : [],
      services: [],
    },
  };
  const challenges = new Map();
  let writes = 0;
  const link = {
    id: randomUUID(),
    agent_id: a.id,
    owner: address(owner),
    controller: address(controller),
    revision: 1,
    agent_revision: 1,
    status: "pending",
    origins: remote ? ["https://agent.example"] : [],
    metadata: a.metadata,
    profile_controller: a.controller,
    profile_revision: 1,
    name: a.name,
  };
  const repository = {
    agent: async () => a,
    link: async () => link,
    createChallenge: async (t, p) =>
      challenges.set(t.message.nonce, {
        payload: { typedData: t, payload: p },
      }),
    challenge: async (n) => challenges.get(n),
    applyIdentity: async (n, ...args) => {
      if (challenges.get(n).used_at) throw Error("replay");
      challenges.get(n).used_at = 1;
      writes++;
      return { args };
    },
  };
  const service = new PersonalAgentService({
    origin,
    repository,
    env: { FACE_IDENTITY_ENABLED: "true" },
    endpointFetcher: async () => ({}),
  });
  const sign = async (c, account = owner) => ({
    nonce: c.typedData.message.nonce,
    payload: c.payload,
    signature: await account.signTypedData(c.typedData),
  });
  return { a, link, service, sign, repository, writes: () => writes };
}
test("personal Agent schemas bound metadata, reject HTTP, oversized prices and local/public contradictions", () => {
  const p = {
    id: randomUUID(),
    name: "Local",
    description: "Test",
    avatar: null,
    capabilities: [],
    endpoints: [],
    registry: null,
    organizations: [],
    published: true,
    localOnly: true,
  };
  assert.ok(platformSchemas["agent.register"].parse(p));
  assert.throws(() =>
    platformSchemas["agent.register"].parse({
      ...p,
      endpoints: [{ protocol: "mcp", url: "https://agent.example/mcp" }],
    }),
  );
  assert.throws(() =>
    platformSchemas["agent.register"].parse({
      ...p,
      agentController: "forged",
    }),
  );
  assert.throws(() =>
    platformSchemas["agent.register"].parse({
      ...p,
      localOnly: false,
      services: [
        {
          id: "a",
          name: "a",
          description: "",
          endpoint: "http://localhost",
          price: null,
        },
      ],
    }),
  );
  assert.throws(() =>
    platformSchemas["agent.register"].parse({
      ...p,
      localOnly: false,
      services: [
        {
          id: "a",
          name: "a",
          description: "",
          endpoint: "https://agent.example",
          price: {
            network: "eip155:84532",
            asset: address(owner),
            payTo: address(owner),
            amount: (2n ** 256n).toString(),
          },
        },
      ],
    }),
  );
});
test("association binds declared controller, current profile and exact wallet signature; no unrestricted tools", async () => {
  const f = fixture(),
    payload = {
      id: f.link.id,
      agentId: f.a.id,
      agentRevision: 1,
      controller: address(controller),
    };
  await assert.rejects(
    f.service.challenge(address(owner), "identity.link", {
      ...payload,
      controller: address(attacker),
    }),
    /declared/,
  );
  await assert.rejects(
    f.service.challenge(address(owner), "identity.link", {
      ...payload,
      agentRevision: 2,
    }),
    /changed/,
  );
  const c = await f.service.challenge(address(owner), "identity.link", payload);
  await assert.rejects(
    f.service.execute(await f.sign(c, attacker)),
    /does not control/,
  );
  await assert.rejects(
    f.service.execute({
      ...(await f.sign(c)),
      payload: { ...c.payload, agentSummary: { name: "Forged" } },
    }),
    /differs/,
  );
  await f.service.execute(await f.sign(c));
  assert.equal(f.writes(), 1);
  await assert.rejects(f.service.execute(await f.sign(c)), /already used/);
  await assert.rejects(
    f.service.challenge(address(owner), "payment.send", {}),
    /Unsupported/,
  );
});
test("controller confirmation and owner revocation reject the other wallet; profile changes invalidate signing context", async () => {
  const f = fixture();
  await assert.rejects(
    f.service.challenge(address(attacker), "identity.link.confirm", {
      id: f.link.id,
      revision: 1,
    }),
    /cannot authorize/,
  );
  await assert.rejects(
    f.service.challenge(address(controller), "identity.link.revoke", {
      id: f.link.id,
      revision: 1,
    }),
    /cannot authorize/,
  );
  const c = await f.service.challenge(
    address(controller),
    "identity.link.confirm",
    { id: f.link.id, revision: 1 },
  );
  f.a.revision = 2;
  f.link.profile_revision = 2;
  await assert.rejects(
    f.service.execute(await f.sign(c, controller)),
    /profile update/,
  );
  f.link.status = "revoked";
  await assert.rejects(
    f.service.challenge(address(owner), "identity.link.refresh", {
      id: f.link.id,
      revision: 1,
      agentRevision: 2,
    }),
    /revoked/,
  );
});
test("endpoint proof binds fresh nonce, owner, controller, association and declared origin", async () => {
  const f = fixture(true);
  await assert.rejects(
    f.service.challenge(address(owner), "identity.verify.endpoint", {
      id: f.link.id,
      revision: 1,
      endpointUrl: "https://other.example",
    }),
    /not declared/,
  );
  const c = await f.service.challenge(
    address(owner),
    "identity.verify.endpoint",
    { id: f.link.id, revision: 1, endpointUrl: "https://agent.example/mcp" },
  );
  f.service.endpointFetcher = async () => ({
    ...c.endpointControl,
    controller: address(attacker),
  });
  await assert.rejects(f.service.execute(await f.sign(c)), /exact current/);
  f.service.endpointFetcher = async () => ({
    ...c.endpointControl,
    nonce: "old-nonce",
  });
  await assert.rejects(f.service.execute(await f.sign(c)), /exact current/);
  let fetched;
  f.service.endpointFetcher = async (url) => {
    fetched = url;
    return c.endpointControl;
  };
  await f.service.execute(await f.sign(c));
  assert.equal(
    fetched,
    "https://agent.example/.well-known/wallet-face-agent.json",
  );
});
test("receiving wallet control requires that wallet signature and a matching published price declaration", async () => {
  const f = fixture();
  f.a.metadata.services = [
    {
      endpoint: "https://agent.example/paid",
      price: { payTo: address(controller), network: "eip155:84532" },
    },
  ];
  const p = {
    agentId: f.a.id,
    agentRevision: 1,
    wallet: address(controller),
    network: "eip155:84532",
  };
  await assert.rejects(
    f.service.challenge(address(owner), "identity.verify.wallet", p),
    /receiving wallet/,
  );
  await assert.rejects(
    f.service.challenge(address(controller), "identity.verify.wallet", {
      ...p,
      network: "eip155:1",
    }),
    /receiving wallet/,
  );
  const c = await f.service.challenge(
    address(controller),
    "identity.verify.wallet",
    p,
  );
  const signed = await f.sign(c, controller);
  await f.service.execute(signed);
  assert.equal(
    await historicalProof(
      {
        typedData: c.typedData,
        signature: signed.signature,
        signedPayload: c.payload,
      },
      address(controller),
      f.a.id,
      null,
      c.payload.agentMetadataHash,
    ),
    true,
  );
  assert.equal(
    await historicalProof(
      {
        typedData: c.typedData,
        signature: signed.signature,
        signedPayload: c.payload,
      },
      address(owner),
      f.a.id,
      null,
      c.payload.agentMetadataHash,
    ),
    false,
  );
});
test("ERC-8004 evidence checks curated registry, RPC chain and token owner at one recorded block", async () => {
  const ref = {
      chainId: 84532,
      registryAddress: identityRegistries[84532],
      tokenId: "4",
    },
    calls = [];
  const factory = () => ({
    getChainId: async () => 84532,
    getBlockNumber: async () => 99n,
    readContract: async (c) => {
      calls.push(c);
      return c.functionName === "ownerOf"
        ? address(owner)
        : c.functionName === "tokenURI"
          ? "ipfs://untrusted"
          : address(controller);
    },
  });
  const result = await verifyRegistration(ref, address(owner), {}, factory);
  assert.equal(result.blockNumber, "99");
  assert.equal(result.registrationFileStatus, "not_fetched");
  assert.ok(calls.every((c) => c.blockNumber === 99n));
  await assert.rejects(
    verifyRegistration(
      { ...ref, registryAddress: address(attacker) },
      address(owner),
      {},
      factory,
    ),
    /documented/,
  );
  await assert.rejects(
    verifyRegistration(ref, address(attacker), {}, factory),
    /differs/,
  );
  await assert.rejects(
    verifyRegistration(ref, address(owner), {}, () => ({
      ...factory(),
      getChainId: async () => 1,
    })),
    /different chain/,
  );
  await assert.rejects(
    verifyRegistration(ref, address(owner), {}),
    /trusted RPC/,
  );
});
test("disabled personal Agent execution remains disabled even when the platform is available", async () => {
  const f = fixture();
  f.service.env.FACE_IDENTITY_ENABLED = "false";
  await assert.rejects(
    f.service.challenge(address(owner), "identity.link", {
      id: f.link.id,
      agentId: f.a.id,
      agentRevision: 1,
      controller: address(controller),
    }),
    /disabled/,
  );
});
