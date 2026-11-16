import { createHash, randomBytes, randomUUID } from "node:crypto";
import { researchWindow } from "./window.mjs";
import { ApiError } from "../validation.mjs";
import { digest } from "../platform/authorization.mjs";
import { createToolRegistry } from "../ai/tools.mjs";
import { internalCopilot } from "./copilot-adapter.mjs";
import { Catalog, ExecutionRepository, platformServices } from "./catalog.mjs";
import { runInput, validateArguments } from "./schemas.mjs";
import { executeMcp, executeA2a, a2aRpc, normalizeA2a } from "./adapters.mjs";
export const tokenHash = (value) =>
  createHash("sha256")
    .update(value || "")
    .digest("hex");
export class RunRepository extends ExecutionRepository {
  async create(input, service, owner, accessHash, planHash) {
    // Separate statements in one READ COMMITTED transaction: the count snapshot
    // is taken after acquiring the shared lock, including concurrent commits.
    const batches = await this.db.transaction([
      [
        "SELECT pg_advisory_xact_lock(hashtextextended('face_execution_storage',0))",
      ],
      [
        "INSERT INTO face_platform.agent_runs(id,service_id,service_version,owner,access_hash,request_hash,plan_hash,plan,input,state) SELECT $1::uuid,$2,$3,$4,$5,$6,$7,$8::jsonb,$9::jsonb,'awaiting_approval' WHERE (SELECT count(*) FROM face_platform.agent_runs)<300 ON CONFLICT DO NOTHING RETURNING *",
        [
          input.id,
          service.id,
          String(service.revision),
          owner,
          accessHash,
          digest(input),
          planHash,
          JSON.stringify(service),
          JSON.stringify(input),
        ],
      ],
    ]);
    const rows = batches[1];
    if (!rows[0])
      throw new ApiError(
        429,
        "RUN_CAPACITY",
        "Task ID is reserved or retained task storage is full; reopen the original task or retry after operator maintenance",
      );
    return rows[0];
  }
  async read(id, actor, secret) {
    return (
      (
        await this.db.query(
          "SELECT * FROM face_platform.agent_runs WHERE id=$1::uuid AND expires_at>now() AND (($2::text IS NOT NULL AND owner=$2) OR (owner IS NULL AND access_hash=$3))",
          [id, actor, tokenHash(secret)],
        )
      )[0] || null
    );
  }
  async events(id) {
    return this.db.query(
      "SELECT id,kind,data,created_at FROM face_platform.agent_run_events WHERE run_id=$1::uuid ORDER BY id LIMIT 100",
      [id],
    );
  }
  async event(id, kind, data) {
    if (Buffer.byteLength(JSON.stringify(data)) > 18000)
      data = {
        message: "Event exceeds detail budget; see bounded task result",
      };
    await this.db.query(
      "INSERT INTO face_platform.agent_run_events(run_id,kind,data) VALUES($1::uuid,$2,$3::jsonb)",
      [id, kind, JSON.stringify(data)],
    );
  }
  async claim(id, executionId) {
    return (
      (
        await this.db.query(
          "UPDATE face_platform.agent_runs r SET state='executing',execution_id=$2::uuid,started_at=coalesce(started_at,now()),lease_until=now()+interval '60 seconds',updated_at=now() WHERE r.id=$1::uuid AND state='awaiting_approval' AND NOT cancel_requested AND expires_at>now() AND (r.service_id=ANY($3::text[]) OR EXISTS(SELECT 1 FROM face_platform.agent_services s JOIN face_platform.agents a ON a.id=s.agent_id WHERE s.id::text=r.service_id AND s.revision::text=r.service_version AND s.published AND NOT s.paused AND s.execution_approved AND s.config->'price'='null'::jsonb AND a.published AND a.revision=s.agent_revision AND EXISTS(SELECT 1 FROM face_platform.agent_links l WHERE l.agent_id=a.id AND l.owner=s.owner AND l.status='active' AND l.controller_confirmed AND l.agent_revision=a.revision AND EXISTS(SELECT 1 FROM jsonb_array_elements(l.endpoint_evidence) e WHERE e->>'url'=s.config->>'endpointOrigin' AND (e->>'checkedAt')::timestamptz>now()-interval '24 hours')))) RETURNING r.*",
          [
            id,
            executionId,
            platformServices("https://walletface.org").map((s) => s.id),
          ],
        )
      )[0] || null
    );
  }
  async update(
    id,
    executionId,
    state,
    result = null,
    error = null,
    remoteTaskId = null,
  ) {
    return (
      (
        await this.db.query(
          "UPDATE face_platform.agent_runs SET state=CASE WHEN cancel_requested THEN 'cancelled' ELSE $3 END,result=CASE WHEN cancel_requested THEN NULL ELSE $4::jsonb END,error_code=$5,remote_task_id=coalesce($6,remote_task_id),completed_at=CASE WHEN $3 IN ('completed','failed','cancelled') THEN now() ELSE NULL END,updated_at=now(),lease_until=NULL WHERE id=$1::uuid AND execution_id=$2::uuid AND state IN ('executing','waiting_remote','needs_input') RETURNING *",
          [
            id,
            executionId,
            state,
            result ? JSON.stringify(result) : null,
            error,
            remoteTaskId,
          ],
        )
      )[0] || null
    );
  }
  async cancel(id) {
    return (
      (
        await this.db.query(
          "UPDATE face_platform.agent_runs SET cancel_requested=true,state=CASE WHEN state IN ('awaiting_approval','waiting_remote','needs_input') THEN 'cancelled' ELSE state END,updated_at=now() WHERE id=$1::uuid AND state IN ('awaiting_approval','executing','waiting_remote','needs_input') RETURNING *",
          [id],
        )
      )[0] || null
    );
  }
  async expireLease(id) {
    await this.db.query(
      "UPDATE face_platform.agent_runs SET state='execution_unknown',error_code='EXECUTION_INTERRUPTED',updated_at=now() WHERE id=$1::uuid AND state='executing' AND lease_until<now()",
      [id],
    );
  }
  async reserve(ip, secret) {
    const hour = Math.floor(Date.now() / 3600000),
      day = Math.floor(Date.now() / 86400000),
      hash = tokenHash(secret + ":" + ip).slice(0, 24);
    const rows = await this.db.query(
      "SELECT face_platform.reserve_quota($1::text[],$2::bigint[],now()+interval '2 days') AS ok",
      [
        [`run:global:${hour}`, `run:ip:${hour}:${hash}`, `run:day:${day}`],
        [1000, 30, 2000],
      ],
    );
    if (!rows[0]?.ok)
      throw new ApiError(
        429,
        "RUN_QUOTA",
        "Shared task limit reached; retry later",
      );
  }
  async analytics(owner, days) {
    return this.db.query(
      "SELECT r.service_id,s.name,date_trunc('day',r.created_at) AS day,count(*)::int AS requests,count(*) FILTER(WHERE r.state='completed')::int AS completed,count(*) FILTER(WHERE r.state='failed')::int AS failed,avg(extract(epoch FROM (r.completed_at-r.started_at))*1000) FILTER(WHERE r.state='completed') AS average_latency_ms FROM face_platform.agent_runs r JOIN face_platform.agent_services s ON s.id::text=r.service_id WHERE s.owner=$1 AND r.created_at>=now()-($2::int*interval '1 day') GROUP BY r.service_id,s.name,day ORDER BY day",
      [owner, days],
    );
  }
}
export async function internalResearch(
  snapshot,
  args,
  { signal, onProgress = async () => {}, language = "en" } = {},
) {
  const window = researchWindow(snapshot, args);
  const registry = createToolRegistry({
      snapshot: window.snapshot,
      signal,
      maxCalls: 2,
    }),
    spaceId = args.spaceId;
  await onProgress({ kind: "tool_started", tool: "getSpace" });
  const space = await registry.run("getSpace", { spaceId });
  await onProgress({ kind: "evidence", result: space });
  await onProgress({ kind: "tool_started", tool: "analyzeParticipation" });
  const activity = await registry.run("analyzeParticipation", { spaceId });
  await onProgress({ kind: "evidence", result: activity });
  const d = activity.data,
    p = activity.provenance;
  const text =
    language === "zh"
      ? `${space.data.space.name || spaceId} 公开治理报告\nUTC 区间：${p.queryRange.startUtc} 至 ${p.queryRange.endUtc}（不含结束时刻）。提案以创建时间筛选，区间内观测到 ${p.proposalsMatchedInScan} 项。\n观测扫描内有 ${d.publicVotes} 条公开投票、${d.uniqueWallets} 个钱包。扫描了 ${p.proposalsScanned} 项提案和 ${p.votesScanned} 条投票记录。\n统计范围仅限本次可用扫描，隐私投票已排除；公开投票不代表组织成员身份。\n读取时间：${p.fetchedAt}`
      : `${space.data.space.name || spaceId} public governance report\nUTC interval: ${p.queryRange.startUtc} to ${p.queryRange.endUtc} (end exclusive). ${p.proposalsMatchedInScan} proposals matched by creation time.\nThe observed scan contains ${d.publicVotes} public votes from ${d.uniqueWallets} wallets, with ${p.proposalsScanned} proposals and ${p.votesScanned} vote records scanned.\nStatistics cover this available scan; private ballots are omitted. Voting is not organization membership.\nRetrieved: ${p.fetchedAt}`;
  return {
    text,
    evidence: [space, activity],
    structured: { space: space.data, analysis: d, scope: p },
    untrustedContent: true,
    modelGenerated: false,
  };
}
export class RunService {
  constructor({
    snapshot,
    origin,
    env = process.env,
    repository,
    catalog,
    mcp = executeMcp,
    a2a = executeA2a,
  }) {
    this.snapshot = snapshot;
    this.origin = origin;
    this.env = env;
    this.repository = repository || new RunRepository(env);
    this.catalog =
      catalog || new Catalog({ origin, env, repository: this.repository });
    this.mcp = mcp;
    this.a2a = a2a;
  }
  async create(raw, actor, ip, requestedToken) {
    const input = runInput.parse(raw),
      token = requestedToken || randomBytes(32).toString("base64url");
    if (!/^[A-Za-z0-9_-]{43}$/.test(token))
      throw new ApiError(400, "RUN_TOKEN", "Use a 256-bit task access token");
    const existing = await this.repository.read(input.id, actor, token);
    if (existing) {
      if (existing.request_hash !== digest(input))
        throw new ApiError(
          409,
          "RUN_EXISTS",
          "Task ID already binds different input",
        );
      return {
        ...this.view(existing),
        ...(actor ? {} : { accessToken: token }),
      };
    }
    const service = await this.catalog.get(input.serviceId);
    validateArguments(service.inputSchema, input.arguments);
    if (service.price)
      throw new ApiError(
        402,
        "PAYMENT_ACTIVATION_REQUIRED",
        "Paid task execution awaits receiving-wallet and settlement acceptance",
      );
    if (!service.executionAvailable)
      throw new ApiError(
        403,
        "SERVICE_UNAVAILABLE",
        "Service is paused, stale or awaiting execution approval",
      );
    await this.repository.reserve(ip, this.env.FACE_SESSION_SECRET);
    const planHash = digest({ service, input }),
      row = await this.repository.create(
        input,
        service,
        actor,
        tokenHash(token),
        planHash,
      );
    await this.repository.event(row.id, "created", {
      serviceId: service.id,
      protocol: service.protocol,
      capability: service.capability,
    });
    return { ...this.view(row), ...(actor ? {} : { accessToken: token }) };
  }
  view(row) {
    return {
      id: row.id,
      owner: row.owner,
      serviceId: row.service_id,
      state: row.state,
      cancelRequested: row.cancel_requested,
      plan: row.plan,
      planHash: row.plan_hash,
      input: row.input,
      result: row.result,
      errorCode: row.error_code,
      remoteTaskId: row.remote_task_id,
      createdAt: row.created_at,
      completedAt: row.completed_at,
      expiresAt: row.expires_at,
      paymentQuoteId: row.payment_quote_id || null,
    };
  }
  async read(id, actor, token) {
    const r = await this.repository.read(id, actor, token);
    if (!r)
      throw new ApiError(
        404,
        "RUN_NOT_FOUND",
        "Task not found or private access expired",
      );
    await this.repository.expireLease(id);
    return (await this.repository.read(id, actor, token)) || r;
  }
  async execute(
    row,
    approvedHash,
    { signal, emit = () => {}, clientIp = "local" } = {},
  ) {
    if (row.plan_hash !== approvedHash)
      throw new ApiError(
        409,
        "PLAN_CHANGED",
        "Approve the exact displayed execution plan",
      );
    const current = await this.catalog.get(row.service_id);
    if (digest(current) !== digest(row.plan) || !current.executionAvailable)
      throw new ApiError(
        409,
        "SERVICE_CHANGED",
        "Service changed; create and review a new task",
      );
    if (
      [
        "completed",
        "cancelled",
        "failed",
        "execution_unknown",
        "waiting_remote",
        "needs_input",
      ].includes(row.state)
    )
      return this.view(row);
    const executionId = randomUUID(),
      claimed = await this.repository.claim(row.id, executionId);
    if (!claimed)
      throw new ApiError(
        409,
        "RUN_IN_PROGRESS",
        "Task already started; reopen it without executing again",
      );
    const onProgress = async (event) => {
      signal?.throwIfAborted();
      if (event.kind !== "text")
        await this.repository.event(row.id, event.kind, event);
      emit(event);
    };
    try {
      await onProgress({ kind: "started", protocol: current.protocol });
      let state = "completed",
        result,
        remoteTaskId;
      if (current.capability === "copilot_governance")
        result = await internalCopilot(this.snapshot, row.input, {
          signal,
          onProgress,
          origin: this.origin,
          env: this.env,
          ip: clientIp,
        });
      else if (current.protocol === "internal")
        result = await internalResearch(this.snapshot, row.input.arguments, {
          signal,
          onProgress,
          language: row.input.language,
        });
      else if (current.protocol === "mcp")
        result = await this.mcp(current, row.input.arguments, {
          signal,
          onProgress,
        });
      else {
        const r = await this.a2a(current, row.input, { signal, onProgress });
        state = r.state;
        result = r.result;
        remoteTaskId = r.remoteTaskId;
      }
      signal?.throwIfAborted();
      const done = await this.repository.update(
        row.id,
        executionId,
        state,
        result,
        null,
        remoteTaskId,
      );
      if (!done) throw new ApiError(409, "RUN_STATE", "Task state changed");
      await this.repository.event(row.id, done.state, {
        remoteTaskId: done.remote_task_id || null,
      });
      emit({ kind: "result", run: this.view(done) });
      return this.view(done);
    } catch (error) {
      const code = signal?.aborted
        ? "CANCELLED"
        : error instanceof ApiError
          ? error.code
          : "EXECUTION_FAILED";
      const done = await this.repository.update(
        row.id,
        executionId,
        signal?.aborted ? "cancelled" : "failed",
        null,
        code,
      );
      await this.repository.event(row.id, "failed", { code });
      emit({
        kind: "error",
        code,
        message:
          error instanceof ApiError
            ? error.message
            : "Agent execution failed; inspect the original task before retrying",
      });
      return done ? this.view(done) : null;
    }
  }
  async poll(row, options = {}) {
    if (
      row.plan.protocol !== "a2a" ||
      row.state !== "waiting_remote" ||
      !row.remote_task_id
    )
      throw new ApiError(
        409,
        "REMOTE_STATE",
        "Task has no pending remote A2A state",
      );
    const current = await this.catalog.get(row.service_id);
    if (!current.executionAvailable || digest(current) !== digest(row.plan))
      throw new ApiError(
        409,
        "SERVICE_CHANGED",
        "Service authorization changed",
      );
    const normalized = normalizeA2a(
      await a2aRpc(
        current,
        "GetTask",
        { id: row.remote_task_id, historyLength: 0 },
        options,
      ),
    );
    if (normalized.remoteTaskId !== row.remote_task_id)
      throw new ApiError(502, "REMOTE_TASK", "Remote task ID changed");
    const updated = await this.repository.update(
      row.id,
      row.execution_id,
      normalized.state,
      normalized.result,
      null,
      row.remote_task_id,
    );
    return this.view(updated || row);
  }
  async cancel(row, options = {}) {
    if (
      row.cancel_requested ||
      ![
        "awaiting_approval",
        "executing",
        "waiting_remote",
        "needs_input",
      ].includes(row.state)
    )
      return this.view(row);
    if (
      row.state === "waiting_remote" &&
      row.plan.protocol === "a2a" &&
      row.remote_task_id
    ) {
      const current = await this.catalog.get(row.service_id);
      if (!current.executionAvailable || digest(current) !== digest(row.plan))
        throw new ApiError(
          409,
          "SERVICE_CHANGED",
          "Remote authorization changed; operator review is required",
        );
      const remote = normalizeA2a(
        await a2aRpc(
          row.plan,
          "CancelTask",
          { id: row.remote_task_id },
          options,
        ),
      );
      if (remote.state !== "cancelled")
        throw new ApiError(
          409,
          "REMOTE_CANCEL",
          "Remote task did not confirm cancellation",
        );
    }
    const r = await this.repository.cancel(row.id);
    await this.repository.event(row.id, "cancellation_requested", {
      remoteCancellationConfirmed: row.state === "waiting_remote",
    });
    return this.view(r || row);
  }
}
