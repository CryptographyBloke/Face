import { z } from "zod";
import { SpendingService, SpendingRepository } from "../spending/service.mjs";
import {
  makeAuthorization,
  verifyAuthorization,
  digest,
} from "../platform/authorization.mjs";
import { https as httpsUrl, uuid } from "../personal/schemas.mjs";
import { ApiError } from "../validation.mjs";
import { probeA2a, probeMcp } from "./probe.mjs";
export const interopEnabled = (env) => env.FACE_INTEROP_ENABLED === "true";
const inputSchema = z
  .object({
    id: uuid,
    revision: z.number().int().positive(),
    endpointUrl: httpsUrl,
  })
  .strict();
export const discoverySchemas = {
  "agent.probe.mcp": inputSchema,
  "agent.probe.a2a": inputSchema,
};
export class InteropRepository extends SpendingRepository {
  async discovery(id) {
    return this.db.query(
      "SELECT protocol,endpoint_url,agent_revision,evidence,checked_at FROM face_platform.agent_discovery_checks WHERE agent_id=$1::uuid ORDER BY checked_at DESC LIMIT 20",
      [id],
    );
  }
  async applyDiscovery(
    nonce,
    actor,
    action,
    hash,
    origin,
    payload,
    proof,
    evidence,
  ) {
    try {
      return (
        await this.db.query(
          "SELECT face_platform.apply_discovery_check($1,$2,$3,$4,$5,$6::jsonb,$7::jsonb,$8::jsonb) AS result",
          [
            nonce,
            actor,
            action,
            hash,
            origin,
            JSON.stringify(payload),
            JSON.stringify(proof),
            JSON.stringify(evidence),
          ],
        )
      )[0].result;
    } catch (e) {
      if (/FACE_DISCOVERY/.test(e.message))
        throw new ApiError(
          409,
          "DISCOVERY_CHANGED",
          "Profile, association or authorization changed; review again",
        );
      throw e;
    }
  }
}
export class InteropService extends SpendingService {
  constructor(options) {
    super({
      ...options,
      repository: options.repository || new InteropRepository(options.env),
    });
    this.a2aProbe = options.a2aProbe || probeA2a;
    this.mcpProbe = options.mcpProbe || probeMcp;
  }
  async discoveryContext(actor, action, p) {
    const a = await this.repository.agent(p.id, true, actor),
      protocol = action === "agent.probe.mcp" ? "mcp" : "a2a";
    if (!a || a.controller !== actor)
      throw new ApiError(
        403,
        "DISCOVERY_OWNER",
        "The profile wallet must authorize service discovery",
      );
    if (a.revision !== p.revision)
      throw new ApiError(409, "REVISION", "Profile changed; reload");
    if (
      !a.metadata.endpoints.some(
        (e) => e.protocol === protocol && e.url === p.endpointUrl,
      )
    )
      throw new ApiError(
        422,
        "DISCOVERY_ENDPOINT",
        "Choose an endpoint declared in the signed profile",
      );
    const identity = await this.identity(a, actor),
      origin = new URL(p.endpointUrl).origin;
    if (
      !identity.links.some(
        (l) =>
          l.owner === actor &&
          l.verification.activeAssociation &&
          l.endpoint_evidence.some(
            (e) =>
              e.url === origin &&
              Date.parse(e.checkedAt) > Date.now() - 86400000,
          ),
      )
    )
      throw new ApiError(
        403,
        "DISCOVERY_CONTROL",
        "Complete an active association and domain-control proof first",
      );
    return {
      ...p,
      protocol,
      endpointOrigin: origin,
      metadataHash: digest({
        metadata: a.metadata,
        revision: a.revision,
        controller: a.controller,
      }),
      operation: "metadata-discovery-only",
      toolExecution: false,
    };
  }
  async challenge(actor, action, input) {
    if (!discoverySchemas[action]) return super.challenge(actor, action, input);
    if (!interopEnabled(this.env))
      throw new ApiError(
        503,
        "INTEROP_DISABLED",
        "Service discovery is disabled",
      );
    actor = actor.toLowerCase();
    const payload = await this.discoveryContext(
        actor,
        action,
        inputSchema.parse(input),
      ),
      typedData = makeAuthorization(this.origin, actor, action, payload);
    await this.repository.createChallenge(typedData, payload);
    return { typedData, payload };
  }
  async execute(input) {
    const saved = await this.repository.challenge(input.nonce),
      action = saved?.payload?.typedData?.message?.action;
    if (!discoverySchemas[action]) return super.execute(input);
    if (!interopEnabled(this.env))
      throw new ApiError(
        503,
        "INTEROP_DISABLED",
        "Service discovery is disabled",
      );
    if (saved.used_at)
      throw new ApiError(409, "REPLAY", "Authorization was already used");
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
      throw new ApiError(403, "PAYLOAD", "Signed discovery content changed");
    const p = inputSchema.parse(
        Object.fromEntries(
          Object.keys(inputSchema.shape).map((k) => [k, input.payload[k]]),
        ),
      ),
      current = await this.discoveryContext(actor, action, p);
    if (digest(current) !== digest(input.payload))
      throw new ApiError(409, "DISCOVERY_CHANGED", "Profile context changed");
    let evidence;
    try {
      evidence = await (
        action === "agent.probe.mcp" ? this.mcpProbe : this.a2aProbe
      )(p.endpointUrl);
    } catch (e) {
      if (e instanceof ApiError) throw e;
      throw new ApiError(
        502,
        "DISCOVERY_UPSTREAM",
        "Service metadata unavailable or unsupported; check public access and schema",
      );
    }
    const proof = {
      typedData: typed,
      signature: input.signature,
      signedPayload: input.payload,
      verifiedAt: new Date().toISOString(),
    };
    return this.repository.applyDiscovery(
      input.nonce,
      actor,
      action,
      typed.message.payloadHash,
      this.origin,
      current,
      proof,
      evidence,
    );
  }
  async manifest(a, actor) {
    const [identity, checks] = await Promise.all([
      this.identity(a, actor),
      this.repository.discovery(a.id),
    ]);
    return {
      schemaVersion: "walletface.agent-discovery/2",
      agentId: a.id,
      profileRevision: a.revision,
      name: a.name,
      profileWallet: a.controller,
      declaredController: identity.declaredController,
      localOnly: identity.localOnly,
      interfaces: a.metadata.endpoints.map((e) => ({
        ...e,
        declaration: "publisher_signed",
        checks: checks
          .filter((c) => c.endpoint_url === e.url && c.protocol === e.protocol)
          .map((c) => ({
            ...c,
            currentProfile: c.agent_revision === a.revision,
          })),
      })),
      capabilities: { status: "self_declared", items: a.metadata.capabilities },
      services: a.metadata.services || [],
      paymentWallets: identity.paymentWallets.map((w) => ({
        wallet: w.wallet,
        network: w.network,
        controlVerified: w.controlVerified,
        checkedAt: w.checked_at,
        settlementProcessed: false,
      })),
      registry: identity.registration,
      associations: identity.links.slice(0, 10).map((l) => ({
        owner: l.owner,
        controller: l.controller,
        status: l.effectiveStatus,
        verification: l.verification,
        endpointEvidence: l.endpoint_evidence,
      })),
      sourceUrl: this.origin + "/agents/" + a.id,
      retrievedAt: new Date().toISOString(),
      taskExecution: false,
      externalToolExecution: false,
      ap2Compliant: false,
    };
  }
}
