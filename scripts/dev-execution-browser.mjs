// Local UI acceptance only: ephemeral task storage, real Snapshot/MCP reads.
// Production and Preview always use RunRepository and durable PostgreSQL.
import { createServer } from "node:http";
import { Snapshot } from "../server/snapshot.mjs";
import { createApi } from "../server/app.mjs";
import { createNodeHandler } from "../server/http.mjs";
import { createExecutionApi } from "../server/execution/api.mjs";
import { RunService } from "../server/execution/runs.mjs";
import { MemoryRuns } from "../test/fixtures/execution-memory.mjs";
if (process.env.VERCEL || process.env.NODE_ENV !== "development")
  throw Error("Local development only");
const origin = "http://localhost:8787",
  env = {
    FACE_EXECUTION_ENABLED: "true",
    FACE_SESSION_SECRET: "local-ui-acceptance-only",
  },
  snapshot = new Snapshot();
const repository = new MemoryRuns();
repository.services = async () => [];
const service = new RunService({ snapshot, origin, env, repository });
const execution = createExecutionApi({ snapshot, origin, env, service });
const existing = createApi({ snapshot, origin, env });
createServer(
  createNodeHandler((request, ip) =>
    /^\/v1\/(marketplace|agent-runs)(\/|$)/.test(new URL(request.url).pathname)
      ? execution(request, ip)
      : existing(request, ip),
  ),
).listen(8787, "127.0.0.1", () =>
  console.log(
    "Local browser acceptance: http://localhost:8787 — ephemeral task storage; real public data; no paid models or payments",
  ),
);
