import assert from "node:assert/strict";
import { writeFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { privateKeyToAccount, generatePrivateKey } from "viem/accounts";
import { probeMcp } from "../server/interop/probe.mjs";
import {
  InteropService,
  InteropRepository,
} from "../server/interop/service.mjs";
if (process.env.FACE_INTEROP_VERIFY_ON_BUILD !== "true") process.exit(0);
if (
  process.env.VERCEL_ENV !== "preview" ||
  !(process.env.FACE_IDENTITY_DATABASE_URL || "").includes(
    "/walletface_identity_preview",
  )
)
  throw Error("Isolated interop Preview required");
const publicMcp = await probeMcp("https://walletface.org/v1/mcp");
assert.equal(publicMcp.tools.length, 5);
assert.equal(publicMcp.toolExecution, false);
const account = privateKeyToAccount(generatePrivateKey()),
  actor = account.address.toLowerCase(),
  repository = new InteropRepository(process.env),
  service = new InteropService({
    origin: "https://interop-acceptance.invalid",
    env: process.env,
    repository,
    snapshot: {},
    a2aProbe: async (url) => ({
      protocol: "a2a",
      status: "metadata_checked",
      sourceUrl: url,
      checkedAt: new Date().toISOString(),
      fixture: true,
      taskExecution: false,
      claims: "operator_declared",
    }),
  });
let endpointBody;
service.endpointFetcher = async () => endpointBody;
async function prepare(action, payload) {
  const c = await service.challenge(actor, action, payload);
  return {
    c,
    input: {
      nonce: c.typedData.message.nonce,
      payload: c.payload,
      signature: await account.signTypedData(c.typedData),
    },
  };
}
async function execute(action, payload) {
  const x = await prepare(action, payload);
  return service.execute(x.input);
}
const id = randomUUID(),
  linkId = randomUUID(),
  url = "https://interop-acceptance.invalid/agent-card.json";
await execute("agent.register", {
  id,
  name: "Private interop acceptance",
  description: "Synthetic fixture; external service is not live",
  avatar: null,
  capabilities: ["acceptance-test"],
  endpoints: [{ protocol: "a2a", url }],
  registry: null,
  organizations: [],
  published: false,
  localOnly: false,
  agentController: actor,
  services: [],
  registration: null,
});
await execute("identity.link", {
  id: linkId,
  agentId: id,
  agentRevision: 1,
  controller: actor,
});
const proof = await prepare("identity.verify.endpoint", {
  id: linkId,
  revision: 1,
  endpointUrl: url,
});
endpointBody = proof.c.endpointControl;
await service.execute(proof.input);
const discovery = await prepare("agent.probe.a2a", {
  id,
  revision: 1,
  endpointUrl: url,
});
await service.execute(discovery.input);
await assert.rejects(service.execute(discovery.input));
const a = await repository.agent(id, true, actor),
  manifest = await service.manifest(a, actor);
assert.equal(manifest.interfaces[0].checks[0].currentProfile, true);
assert.equal(manifest.externalToolExecution, false);
const report = {
  checkedAt: new Date().toISOString(),
  realPublicMcp: true,
  mcpTools: publicMcp.tools.map((t) => t.name),
  mcpExternalToolExecuted: false,
  realPostgres: true,
  realWalletSignature: true,
  remoteDomainProofSource: "controlled fixture",
  remoteA2aSource: "controlled fixture",
  actualRemoteAgentOwnership: false,
  checks: [
    { name: "real-production-mcp-discovery", success: true },
    {
      name: "signed-discovery-atomic-db-persistence-and-replay",
      success: true,
    },
    {
      name: "versioned-declaration-manifest-separates-control-and-capability",
      success: true,
    },
  ],
};
await writeFile(
  "web/dist/interop-verification.json",
  JSON.stringify(report, null, 2),
);
console.log("FACE_INTEROP_LIVE_CHECK " + JSON.stringify(report));
