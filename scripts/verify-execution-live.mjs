import assert from "node:assert/strict";
import { writeFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { Snapshot } from "../server/snapshot.mjs";
import { RunService, RunRepository } from "../server/execution/runs.mjs";
import { createServer } from "node:http";
import { createNodeHandler } from "../server/http.mjs";
import { createResearchAgent } from "../server/execution/research-agent.mjs";
import { executeA2a, a2aRpc } from "../server/execution/adapters.mjs";
import { executeMcp } from "../server/execution/adapters.mjs";
import { platformServices } from "../server/execution/catalog.mjs";
if (process.env.FACE_EXECUTION_VERIFY_ON_BUILD !== "true") process.exit(0);
if (
  process.env.VERCEL_ENV !== "preview" ||
  !(process.env.FACE_IDENTITY_DATABASE_URL || "").includes(
    "/walletface_identity_preview",
  )
)
  throw Error("Isolated execution Preview database required");
const origin = "https://execution-acceptance.invalid",
  snapshot = new Snapshot(),
  repository = new RunRepository(process.env),
  service = new RunService({ snapshot, origin, repository, env: process.env });
const input = {
    id: randomUUID(),
    serviceId: "walletface-governance",
    task: "Acceptance: actual observed public ENS records",
    arguments: { spaceId: "ens.eth" },
    language: "en",
    retainResult: true,
  },
  created = await service.create(input, null, "execution-build");
await assert.rejects(service.read(created.id, null, "wrong-credential"));
const row = await service.read(created.id, null, created.accessToken),
  attempts = await Promise.allSettled(
    Array.from({ length: 3 }, () => service.execute(row, created.planHash)),
  );
assert.equal(attempts.filter((x) => x.status === "fulfilled").length, 1);
const finished = await service.read(created.id, null, created.accessToken);
assert.equal(finished.state, "completed");
assert.ok(
  finished.result.evidence.every((e) =>
    e.provenance.sourceUrl.startsWith("https://snapshot.box/"),
  ),
);
const replay = await service.execute(finished, created.planHash);
assert.equal(replay.id, created.id);
assert.equal(replay.state, "completed");
const events = await repository.events(created.id);
assert.equal(events.filter((e) => e.kind === "started").length, 1);
const mcp = await executeMcp(
  platformServices(origin).find((s) => s.protocol === "mcp"),
  { spaceId: "yam.eth" },
);
assert.equal(mcp.structured.tool, "getSpace");
assert.equal(mcp.structured.data.space.id, "yam.eth");
// Actual HTTP protocol exchange against the project-controlled implementation,
// using real PostgreSQL and Snapshot; transport override is local test wiring.
// This does not establish independently operated external Agent ownership.
const research = createResearchAgent({ snapshot, origin, env: process.env });
const httpServer = createServer(createNodeHandler(research));
await new Promise((resolve) => httpServer.listen(0, "127.0.0.1", resolve));
let a2aResult;
try {
  const port = httpServer.address().port;
  const fetcher = (_url, init) =>
    fetch(`http://127.0.0.1:${port}/v1/research-agent/rpc`, {
      ...init,
      headers: { ...init.headers, "Content-Type": "application/json" },
    });
  const a2aService = platformServices(origin).find((s) => s.protocol === "a2a"),
    a2aInput = {
      ...input,
      id: randomUUID(),
      arguments: { spaceId: "ens.eth", periodDays: 30 },
    };
  a2aResult = await executeA2a(a2aService, a2aInput, { fetcher });
  assert.equal(a2aResult.state, "completed");
  assert.ok(a2aResult.result.text.includes("UTC interval"));
  const reopened = await a2aRpc(
    a2aService,
    "GetTask",
    { id: a2aResult.remoteTaskId },
    { fetcher },
  );
  assert.equal(reopened.status.state, "TASK_STATE_COMPLETED");
  const repeated = await executeA2a(a2aService, a2aInput, { fetcher });
  assert.equal(repeated.remoteTaskId, a2aResult.remoteTaskId);
  await assert.rejects(
    executeA2a(
      a2aService,
      { ...a2aInput, arguments: { spaceId: "ens.eth", periodDays: 7 } },
      { fetcher },
    ),
  );
} finally {
  await new Promise((resolve) => httpServer.close(resolve));
}
const report = {
  checkedAt: new Date().toISOString(),
  realPostgres: true,
  realSnapshot: true,
  realPublicMcpTool: true,
  realA2aHttp: false,
  controlledA2aHttp: true,
  controlledA2aPersistentReplay: true,
  independentThirdPartyOwnership: false,
  paidModelCalls: 0,
  testnetSettlementVerified: false,
  runConcurrency: { accepted: 1, rejected: 2 },
  privateResultIsolation: true,
  replayExecutedAgain: false,
  scanScope: finished.result.evidence[1].provenance,
};
await writeFile(
  "web/dist/execution-verification.json",
  JSON.stringify(report, null, 2),
);
console.log("FACE_EXECUTION_LIVE_CHECK " + JSON.stringify(report));
