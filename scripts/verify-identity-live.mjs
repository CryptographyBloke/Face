import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { writeFile } from "node:fs/promises";
import { privateKeyToAccount, generatePrivateKey } from "viem/accounts";
import { PersonalAgentRepository } from "../server/personal/repository.mjs";
import { PersonalAgentService } from "../server/personal/service.mjs";
if (process.env.FACE_IDENTITY_VERIFY_ON_BUILD !== "true") process.exit(0);
if (
  process.env.VERCEL_ENV !== "preview" ||
  !(
    process.env.FACE_IDENTITY_DATABASE_URL || process.env.FACE_DATABASE_URL
  )?.includes("/walletface_identity_preview")
)
  throw Error("Isolated identity Preview database required");
const repository = new PersonalAgentRepository(process.env),
  owner = privateKeyToAccount(generatePrivateKey()),
  controller = privateKeyToAccount(generatePrivateKey()),
  other = privateKeyToAccount(generatePrivateKey()),
  actor = (a) => a.address.toLowerCase(),
  checks = [];
const service = new PersonalAgentService({
  origin: "https://identity-acceptance.invalid",
  repository,
  env: process.env,
  snapshot: {},
});
const prepare = async (account, action, payload) => {
  const c = await service.challenge(actor(account), action, payload);
  return {
    nonce: c.typedData.message.nonce,
    payload: c.payload,
    signature: await account.signTypedData(c.typedData),
  };
};
const execute = async (account, action, payload) =>
  service.execute(await prepare(account, action, payload));
const metadata = {
  id: randomUUID(),
  name: "Identity acceptance record",
  description: "Synthetic test wallet. Not a public service.",
  avatar: null,
  capabilities: ["acceptance-test"],
  endpoints: [],
  registry: null,
  organizations: [],
  published: false,
  localOnly: true,
  agentController: actor(owner),
  services: [],
  registration: null,
};
await execute(owner, "agent.register", metadata);
let id = randomUUID();
const first = await prepare(owner, "identity.link", {
  id,
  agentId: metadata.id,
  agentRevision: 1,
  controller: actor(owner),
});
const attempts = await Promise.allSettled(
  Array.from({ length: 4 }, () => service.execute(first)),
);
assert.equal(attempts.filter((x) => x.status === "fulfilled").length, 1);
let a = await repository.agent(metadata.id, true, actor(owner)),
  l = await repository.link(id, actor(owner));
assert.equal(
  (await service.checkedLink(l, a)).verification.activeAssociation,
  true,
);
assert.equal(
  (await service.checkedLink(l, a)).availability,
  "local_not_publicly_reachable",
);
checks.push({
  name: "real-postgres-local-association-one-of-four-concurrent-nonces",
  success: true,
  accepted: 1,
  rejected: 3,
});
await assert.rejects(
  service.challenge(actor(other), "identity.link.revoke", { id, revision: 1 }),
);
await execute(owner, "agent.update", {
  ...metadata,
  revision: 1,
  name: "Changed acceptance record",
  agentController: actor(controller),
});
a = await repository.agent(metadata.id, true, actor(owner));
l = await repository.link(id, actor(owner));
assert.equal(
  (await service.checkedLink(l, a)).effectiveStatus,
  "stale_profile",
);
await execute(owner, "identity.link.refresh", {
  id,
  revision: l.revision,
  agentRevision: a.revision,
});
l = await repository.link(id, actor(owner));
assert.equal(l.status, "pending");
await execute(controller, "identity.link.confirm", {
  id,
  revision: l.revision,
});
l = await repository.link(id, actor(owner));
assert.equal(
  (await service.checkedLink(l, a)).verification.activeAssociation,
  true,
);
checks.push({
  name: "profile-change-requires-fresh-owner-and-separate-controller-signatures",
  success: true,
});
await execute(owner, "identity.link.revoke", { id, revision: l.revision });
l = await repository.link(id, actor(owner));
assert.equal(
  (await service.checkedLink(l, a)).verification.activeAssociation,
  false,
);
await assert.rejects(
  service.challenge(actor(owner), "identity.link.confirm", {
    id,
    revision: l.revision,
  }),
);
checks.push({
  name: "revocation-invalidates-association-and-blocks-replay",
  success: true,
});
const receiver = actor(controller),
  remote = {
    ...metadata,
    id: randomUUID(),
    name: "Receiving-wallet acceptance record",
    published: true,
    localOnly: false,
    agentController: actor(owner),
    services: [
      {
        id: "research",
        name: "Synthetic paid service declaration",
        description: "Test declaration; no service or settlement",
        endpoint: "https://agent-acceptance.invalid/report",
        price: {
          network: "eip155:84532",
          asset: "0x036CbD53842c5426634e7929541eC2318f3dCF7e",
          amount: "1000",
          payTo: receiver,
        },
      },
    ],
  };
await execute(owner, "agent.register", remote);
await assert.rejects(
  service.challenge(actor(owner), "identity.verify.wallet", {
    agentId: remote.id,
    agentRevision: 1,
    wallet: receiver,
    network: "eip155:84532",
  }),
);
await execute(controller, "identity.verify.wallet", {
  agentId: remote.id,
  agentRevision: 1,
  wallet: receiver,
  network: "eip155:84532",
});
a = await repository.agent(remote.id);
let evidence = await service.identity(a, null);
assert.equal(evidence.paymentWallets[0].controlVerified, true);
assert.equal(evidence.paymentWallets[0].settlementProcessed, false);
await execute(controller, "identity.wallet.revoke", {
  agentId: remote.id,
  wallet: receiver,
  network: "eip155:84532",
  revision: evidence.paymentWallets[0].revision,
});
evidence = await service.identity(a, null);
assert.equal(evidence.paymentWallets[0].controlVerified, false);
checks.push({
  name: "separate-receiving-wallet-signature-and-revocation-no-settlement-claim",
  success: true,
});
const linkId = randomUUID();
await execute(owner, "identity.link", {
  id: linkId,
  agentId: remote.id,
  agentRevision: 1,
  controller: actor(owner),
});
l = await repository.link(linkId, actor(owner));
assert.equal(l.status, "pending");
assert.equal(
  (await service.checkedLink(l, a)).verification.activeAssociation,
  false,
);
await execute(owner, "identity.link.disconnect", {
  id: linkId,
  revision: l.revision,
});
checks.push({
  name: "remote-agent-never-active-without-domain-control-disconnection-recorded",
  success: true,
});
await execute(owner, "agent.update", {
  ...remote,
  revision: 1,
  published: false,
});
assert.equal(await repository.agent(remote.id), null);
const report = {
  checkedAt: new Date().toISOString(),
  syntheticWalletsOnly: true,
  realPostgres: true,
  realEndpointOwnership: false,
  realRegistryRead: false,
  checks,
};
await writeFile(
  "web/dist/identity-verification.json",
  JSON.stringify(report, null, 2),
);
console.log("FACE_IDENTITY_LIVE_CHECK " + JSON.stringify(report));
