import { z } from "zod";
import { InteropRepository, InteropService } from "../interop/service.mjs";
import { serviceInput, checkSchema } from "./schemas.mjs";
import { endpointUrl } from "./http.mjs";
import {
  digest,
  makeAuthorization,
  verifyAuthorization,
} from "../platform/authorization.mjs";
import { ApiError } from "../validation.mjs";
const schema = {
  type: "object",
  properties: { spaceId: { type: "string", minLength: 1, maxLength: 100 } },
  required: ["spaceId"],
  additionalProperties: false,
};
const researchSchema = {
  ...schema,
  properties: {
    ...schema.properties,
    periodDays: {
      type: "integer",
      minimum: 1,
      maximum: 365,
      description: "UTC lookback days; default 30. Bounded observed data only.",
    },
  },
};
export function platformServices(origin) {
  return [
    {
      id: "walletface-copilot",
      agentId: null,
      name: "Face Copilot Research",
      description:
        "AI governance research with real public tools, streaming interpretation and source evidence. Shared model quotas apply.",
      category: "governance",
      protocol: "internal",
      capability: "copilot_governance",
      inputSchema: researchSchema,
      endpointUrl: null,
      price: null,
      platformProvided: true,
      revision: 1,
      owner: null,
    },
    {
      id: "walletface-governance",
      agentId: null,
      name: "Wallet Face Governance Research",
      description:
        "Observed public Snapshot proposals and participation, computed in code with source evidence.",
      category: "governance",
      protocol: "internal",
      capability: "governance_report",
      inputSchema: researchSchema,
      endpointUrl: null,
      price: null,
      platformProvided: true,
      revision: 1,
      owner: null,
    },
    {
      id: "walletface-public-mcp",
      agentId: null,
      name: "Wallet Face Public MCP",
      description: "Call the real public get_space MCP tool through HTTPS.",
      category: "governance",
      protocol: "mcp",
      capability: "get_space",
      inputSchema: schema,
      endpointUrl: "https://walletface.org/v1/mcp",
      schemaHash: null,
      price: null,
      platformProvided: true,
      revision: 1,
      owner: null,
    },
    {
      id: "walletface-a2a-research",
      agentId: null,
      name: "Wallet Face A2A Research",
      description: "A2A v1 JSON-RPC governance research compatibility service.",
      category: "governance",
      protocol: "a2a",
      capability: "governance_research",
      inputSchema: researchSchema,
      endpointUrl: origin + "/v1/research-agent/rpc",
      schemaHash: digest(researchSchema),
      price: null,
      platformProvided: true,
      revision: 1,
      owner: null,
    },
  ];
}
export function approvedService(service, env) {
  if (service.platformProvided) return true;
  let entries = [];
  try {
    entries = JSON.parse(env.FACE_EXECUTION_ALLOWLIST || "[]");
  } catch {
    return false;
  }
  return (
    Array.isArray(entries) &&
    entries.some(
      (e) =>
        e.endpointUrl === service.endpointUrl &&
        e.capability === service.capability &&
        e.schemaHash === service.schemaHash &&
        e.protocol === service.protocol,
    )
  );
}
export class ExecutionRepository extends InteropRepository {
  controlProjection =
    "EXISTS(SELECT 1 FROM face_platform.agent_links l WHERE l.agent_id=s.agent_id AND l.owner=s.owner AND l.status='active' AND l.controller_confirmed AND l.agent_revision=a.revision AND EXISTS(SELECT 1 FROM jsonb_array_elements(l.endpoint_evidence) e WHERE e->>'url'=s.config->>'endpointOrigin' AND (e->>'checkedAt')::timestamptz>now()-interval '24 hours')) AS control_current";
  async services() {
    return this.db.query(
      `SELECT s.*,a.revision AS profile_revision,a.published AS profile_published,${this.controlProjection} FROM face_platform.agent_services s JOIN face_platform.agents a ON a.id=s.agent_id WHERE s.published ORDER BY s.updated_at DESC LIMIT 100`,
    );
  }
  async service(id, actor = null) {
    return (
      (
        await this.db.query(
          `SELECT s.*,a.revision AS profile_revision,a.published AS profile_published,${this.controlProjection} FROM face_platform.agent_services s JOIN face_platform.agents a ON a.id=s.agent_id WHERE s.id=$1::uuid AND (s.published OR s.owner=$2)`,
          [id, actor],
        )
      )[0] || null
    );
  }
  async applyService(nonce, actor, action, hash, origin, payload, proof) {
    try {
      return (
        await this.db.query(
          "SELECT face_platform.apply_market_service($1,$2,$3,$4,$5,$6::jsonb,$7::jsonb) AS result",
          [
            nonce,
            actor,
            action,
            hash,
            origin,
            JSON.stringify(payload),
            JSON.stringify(proof),
          ],
        )
      )[0].result;
    } catch (e) {
      if (/FACE_MARKET|duplicate key/.test(e.message))
        throw new ApiError(
          409,
          "SERVICE_CHANGED",
          "Service, ownership or authorization changed",
        );
      throw e;
    }
  }
}
export class MarketplaceControl extends InteropService {
  constructor(options) {
    super({
      ...options,
      repository: options.repository || new ExecutionRepository(options.env),
    });
  }
  async serviceContext(actor, input) {
    const p = serviceInput.parse(input);
    checkSchema(p.inputSchema);
    endpointUrl(p.endpointUrl);
    await this.discoveryContext(
      actor,
      p.protocol === "mcp" ? "agent.probe.mcp" : "agent.probe.a2a",
      { id: p.agentId, revision: p.agentRevision, endpointUrl: p.endpointUrl },
    );
    const checks = await this.repository.discovery(p.agentId),
      record = checks.find(
        (c) =>
          c.protocol === p.protocol &&
          c.endpoint_url === p.endpointUrl &&
          c.agent_revision === p.agentRevision &&
          Date.parse(c.checked_at) > Date.now() - 86400000,
      );
    if (!record)
      throw new ApiError(
        422,
        "SERVICE_DISCOVERY",
        "Recheck service metadata before publication",
      );
    const declared =
      p.protocol === "mcp"
        ? record.evidence.tools?.find((t) => t.name === p.capability)
        : record.evidence.card?.skills?.find((t) => t.id === p.capability);
    if (!declared)
      throw new ApiError(
        422,
        "CAPABILITY",
        "Choose a capability from verified discovery",
      );
    if (
      p.protocol === "mcp" &&
      (!declared.inputSchema ||
        digest(declared.inputSchema) !== digest(p.inputSchema))
    )
      throw new ApiError(
        422,
        "CAPABILITY_SCHEMA",
        "Input schema must match discovered tool",
      );
    let executionEndpointUrl = p.endpointUrl;
    if (p.protocol === "a2a") {
      const iface = record.evidence.card.supportedInterfaces.find(
        (i) =>
          i.protocolBinding === "JSONRPC" &&
          /^1\.0(?:\.\d+)?$/.test(i.protocolVersion),
      );
      if (!iface || new URL(iface.url).origin !== new URL(p.endpointUrl).origin)
        throw new ApiError(
          422,
          "A2A_INTERFACE",
          "Use a v1 JSON-RPC interface on the verified Agent Card origin",
        );
      endpointUrl(iface.url);
      executionEndpointUrl = iface.url;
    }
    if (p.price) {
      const a = await this.repository.agent(p.agentId, true, actor),
        identity = await this.identity(a, actor);
      if (
        !identity.paymentWallets.some(
          (w) =>
            w.wallet.toLowerCase() === p.price.payTo.toLowerCase() &&
            w.network === p.price.network &&
            w.controlVerified,
        )
      )
        throw new ApiError(
          403,
          "RECEIVER_CONTROL",
          "The receiving wallet must separately verify control",
        );
    }
    return {
      ...p,
      endpointOrigin: new URL(p.endpointUrl).origin,
      executionEndpointUrl,
      schemaHash: digest(p.inputSchema),
      readOnlyDeclared: true,
      taskExecutionRequiresOperatorReview: true,
    };
  }
  async pauseContext(actor, input) {
    const payload = z
      .object({ id: z.string().uuid(), revision: z.number().int().positive() })
      .strict()
      .parse(input);
    const saved = await this.repository.service(payload.id, actor);
    if (!saved || saved.owner !== actor || saved.revision !== payload.revision)
      throw new ApiError(
        409,
        "SERVICE_CHANGED",
        "Service owner or revision changed",
      );
    return payload;
  }
  async challenge(actor, action, input) {
    if (!["market.service.upsert", "market.service.pause"].includes(action))
      return super.challenge(actor, action, input);
    if (this.env.FACE_EXECUTION_ENABLED !== "true")
      throw new ApiError(
        503,
        "EXECUTION_DISABLED",
        "Agent execution is disabled",
      );
    actor = actor.toLowerCase();
    const payload =
        action === "market.service.pause"
          ? await this.pauseContext(actor, input)
          : await this.serviceContext(actor, input),
      typedData = makeAuthorization(this.origin, actor, action, payload);
    await this.repository.createChallenge(typedData, payload);
    return { typedData, payload };
  }
  async execute(input) {
    const saved = await this.repository.challenge(input.nonce);
    if (
      !["market.service.upsert", "market.service.pause"].includes(
        saved?.payload?.typedData?.message?.action,
      )
    )
      return super.execute(input);
    if (this.env.FACE_EXECUTION_ENABLED !== "true")
      throw new ApiError(
        503,
        "EXECUTION_DISABLED",
        "Agent execution is disabled",
      );
    if (saved.used_at)
      throw new ApiError(409, "REPLAY", "Authorization already used");
    const typed = saved.payload.typedData,
      actor = await verifyAuthorization(
        typed,
        input.signature,
        input.payload,
        this.origin,
      );
    if (
      typed.message.nonce !== input.nonce ||
      digest(saved.payload.payload) !== digest(input.payload)
    )
      throw new ApiError(403, "PAYLOAD", "Signed service changed");
    const base = Object.fromEntries(
        Object.keys(serviceInput.shape).map((k) => [k, input.payload[k]]),
      ),
      current =
        typed.message.action === "market.service.pause"
          ? await this.pauseContext(actor, input.payload)
          : await this.serviceContext(actor, base);
    if (digest(current) !== digest(input.payload))
      throw new ApiError(409, "SERVICE_CHANGED", "Service context changed");
    return this.repository.applyService(
      input.nonce,
      actor,
      typed.message.action,
      typed.message.payloadHash,
      this.origin,
      current,
      {
        typedData: typed,
        signature: input.signature,
        signedPayload: input.payload,
        verifiedAt: new Date().toISOString(),
      },
    );
  }
}
export class Catalog {
  constructor({ origin, env = process.env, repository }) {
    this.origin = origin;
    this.env = env;
    this.repository = repository || new ExecutionRepository(env);
  }
  project(row) {
    return {
      ...row.config,
      discoveryUrl: row.config.endpointUrl,
      endpointUrl: row.config.executionEndpointUrl || row.config.endpointUrl,
      id: row.id,
      agentId: row.agent_id,
      owner: row.owner,
      revision: row.revision,
      paused: row.paused,
      published: row.published,
      profileCurrent:
        row.profile_revision === row.agent_revision &&
        row.profile_published &&
        row.control_current,
      platformProvided: false,
      executionApproved: row.execution_approved === true,
      updatedAt: row.updated_at,
    };
  }
  status(service) {
    const approved =
        approvedService(service, this.env) &&
        (service.platformProvided || service.executionApproved === true),
      current = service.platformProvided || service.profileCurrent;
    return {
      ...service,
      operatorApproved: approved,
      executionAvailable:
        this.env.FACE_EXECUTION_ENABLED === "true" &&
        approved &&
        current &&
        !service.paused &&
        !service.price,
      availability: !current
        ? "stale_profile"
        : service.paused
          ? "paused"
          : !approved
            ? "pending_operator_review"
            : service.price
              ? "payment_activation_required"
              : "ready",
      capabilityClaims: service.platformProvided
        ? "platform_implementation"
        : "publisher_declared",
    };
  }
  async list(query = {}) {
    const all = [
      ...platformServices(this.origin),
      ...(await this.repository.services()).map((r) => this.project(r)),
    ];
    const q = (query.q || "").toLowerCase();
    return all
      .map((s) => this.status(s))
      .filter(
        (s) =>
          (!q ||
            [s.name, s.description, s.capability, s.owner]
              .join(" ")
              .toLowerCase()
              .includes(q)) &&
          (!query.category || s.category === query.category) &&
          (!query.protocol || s.protocol === query.protocol) &&
          (!query.price || (query.price === "free" ? !s.price : !!s.price)),
      );
  }
  async get(id) {
    const local = platformServices(this.origin).find((s) => s.id === id);
    if (local) return this.status(local);
    if (!/^[0-9a-f-]{36}$/i.test(id))
      throw new ApiError(404, "SERVICE_NOT_FOUND", "Service not found");
    const row = await this.repository.service(id);
    if (!row) throw new ApiError(404, "SERVICE_NOT_FOUND", "Service not found");
    return this.status(this.project(row));
  }
}
