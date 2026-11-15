import { writeFile } from "node:fs/promises";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { privateKeyToAccount, generatePrivateKey } from "viem/accounts";
import { platformDb } from "../server/platform/db.mjs";
import { PlatformRepository } from "../server/platform/repository.mjs";
import { PlatformService, checkedAgent } from "../server/platform/service.mjs";
import { postgresQuota } from "../server/platform/ai-quota.mjs";
import { Snapshot } from "../server/snapshot.mjs";
import { GovernanceIndex } from "../server/platform/indexer.mjs";
import { LIMITS } from "../server/ai/quota.mjs";
if (process.env.FACE_PLATFORM_VERIFY_ON_BUILD !== "true") process.exit(0);
if (process.env.VERCEL_ENV !== "preview") throw new Error("Preview only");
const checks = [],
  db = platformDb(),
  repository = new PlatformRepository(process.env, db),
  account = privateKeyToAccount(generatePrivateKey()),
  actor = account.address.toLowerCase(),
  origin = "https://platform-acceptance.invalid";
const service = new PlatformService({
  origin,
  repository,
  env: process.env,
  snapshot: { space: async () => ({ admins: [actor] }) },
});
const authorize = async (action, payload) => {
  const c = await service.challenge(actor, action, payload);
  const input = {
    nonce: c.typedData.message.nonce,
    signature: await account.signTypedData(c.typedData),
    payload: c.payload,
  };
  return { result: await service.execute(input), input };
};
const id = randomUUID();
const registered = await authorize("agent.register", {
  id,
  name: "Isolated acceptance record",
  description: "Synthetic test wallet; not a real Agent",
  avatar: null,
  capabilities: ["acceptance-test"],
  endpoints: [],
  registry: null,
  organizations: [],
  published: false,
});
assert.equal(
  (await checkedAgent(await repository.agent(id, true, actor)))
    .controllerVerification.metadataSignatureVerified,
  true,
);
assert.equal(await repository.agent(id), null);
checks.push({ name: "real-postgres-signed-private-agent", success: true });
const session = await authorize("session.create", {
  purpose: "workspace.read",
});
assert.ok(session.result.token);
await assert.rejects(service.execute(session.input));
checks.push({ name: "replay-rejected", success: true });
const c = await service.challenge(actor, "agent.update", {
  id,
  name: "Updated acceptance record",
  description: "Synthetic test wallet",
  avatar: null,
  capabilities: ["acceptance-test"],
  endpoints: [],
  registry: null,
  organizations: [],
  published: false,
  revision: 1,
});
const signature = await account.signTypedData(c.typedData);
const attempts = await Promise.allSettled(
  Array.from({ length: 4 }, () =>
    service.execute({
      nonce: c.typedData.message.nonce,
      signature,
      payload: c.payload,
    }),
  ),
);
assert.equal(attempts.filter((x) => x.status === "fulfilled").length, 1);
checks.push({
  name: "concurrent-nonce-one-winner",
  accepted: 1,
  rejected: 3,
  success: true,
});
const actionId = randomUUID(),
  spaceId = "walletface-acceptance-" + Date.now() + ".eth";
await authorize("action.prepare", {
  id: actionId,
  spaceId,
  kind: "announcement.publish",
  content: {
    title: "Synthetic acceptance test",
    body: "Isolated database workflow test; admin source is controlled fixture.",
  },
});
let a = await repository.action(actionId, actor);
await assert.rejects(
  authorize("action.execute", {
    id: a.id,
    revision: a.revision,
    contentHash: a.content_hash,
  }),
);
await authorize("action.approve", {
  id: a.id,
  revision: a.revision,
  contentHash: a.content_hash,
});
a = await repository.action(actionId, actor);
await authorize("action.execute", {
  id: a.id,
  revision: a.revision,
  contentHash: a.content_hash,
});
a = await repository.action(actionId, actor);
assert.equal(a.state, "executed");
assert.equal((await repository.records(spaceId)).length, 1);
checks.push({
  name: "prepare-approve-execute-atomic-workflow",
  success: true,
  authoritySource:
    "controlled Snapshot admin fixture; no real administrator impersonation",
});
assert.equal((await repository.audit(actionId, actor)).length, 3);
const quota = postgresQuota(
  { ...process.env, VERCEL_ENV: "acceptance-" + randomUUID() },
  { ...LIMITS, globalDailyRequests: 5, ipHourlyRequests: 50 },
);
const reservations = await Promise.allSettled(
  Array.from({ length: 12 }, (_, i) => quota.reserve("isolated-test-" + i)),
);
assert.equal(reservations.filter((x) => x.status === "fulfilled").length, 5);
checks.push({
  name: "real-postgres-global-budget-concurrency",
  accepted: 5,
  rejected: 7,
  success: true,
});
const index = new GovernanceIndex({ snapshot: new Snapshot(), db });
for (const space of ["ens.eth", "yam.eth"]) {
  const result = await index.refresh(space);
  assert.ok(result.votesFetched > 0);
  assert.ok(result.provenance.sourceUrl.startsWith("https://snapshot.box/"));
  checks.push({
    name: "real-snapshot-index-" + space,
    success: true,
    votesFetched: result.votesFetched,
    privateVotesOmitted: result.privateVotesOmitted,
    observedPublicVotes: result.votes,
    observedWallets: result.wallets,
    completeness: result.provenance.completeness,
  });
}
const report = {
  checkedAt: new Date().toISOString(),
  syntheticWalletsOnly: true,
  checks,
};
await writeFile(
  "web/dist/platform-verification.json",
  JSON.stringify(report, null, 2),
);
console.log("FACE_PLATFORM_LIVE_CHECK " + JSON.stringify(report));
