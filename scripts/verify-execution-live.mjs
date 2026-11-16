import assert from "node:assert/strict";
import { writeFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { Snapshot } from "../server/snapshot.mjs";
import { RunService, RunRepository } from "../server/execution/runs.mjs";
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
const report = {
  checkedAt: new Date().toISOString(),
  realPostgres: true,
  realSnapshot: true,
  realPublicMcpTool: true,
  realA2aHttp: false,
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
