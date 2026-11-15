import { recoverTypedDataAddress } from "viem";
import { PlatformService } from "../platform/service.mjs";
import { PersonalAgentRepository } from "./repository.mjs";
import { identitySchemas } from "./schemas.mjs";
import {
  makeAuthorization,
  verifyAuthorization,
  digest,
  platformTypes,
} from "../platform/authorization.mjs";
import {
  endpointProofRequest,
  fetchPublicJson,
} from "../platform/endpoint-proof.mjs";
import { verifyRegistration } from "./registry.mjs";
import { ApiError } from "../validation.mjs";
export const identityEnabled = (env) => env.FACE_IDENTITY_ENABLED === "true";
const expectedController = (a) =>
  (a.metadata.agentController || a.controller).toLowerCase();
export const declaredOrigins = (a) =>
  [
    ...new Set([
      ...(a.metadata.endpoints || []).map((e) => new URL(e.url).origin),
      ...(a.metadata.services || []).map((s) => new URL(s.endpoint).origin),
    ]),
  ].sort();
const metadataHash = (a) =>
  digest({
    agentId: a.id,
    profileWallet: a.controller,
    revision: a.revision,
    metadata: a.metadata,
  });
function summary(a) {
  return {
    name: a.name,
    profileWallet: a.controller,
    agentController: expectedController(a),
    localOnly: declaredOrigins(a).length === 0,
    endpointOrigins: declaredOrigins(a),
    prices: (a.metadata.services || [])
      .filter((s) => s.price)
      .map((s) => s.price),
  };
}
export async function historicalProof(proof, actor, agentId, linkId, hash) {
  try {
    const t = proof.typedData,
      m = t.message;
    if (
      t.domain.name !== "Wallet Face Agent Platform" ||
      t.domain.version !== "1" ||
      t.domain.chainId !== 1 ||
      t.primaryType !== "Authorization" ||
      digest(t.types) !== digest(platformTypes) ||
      m.actor.toLowerCase() !== actor ||
      digest(proof.signedPayload) !== m.payloadHash ||
      t.domain.salt !==
        makeAuthorization(m.origin, actor, m.action, {}).domain.salt ||
      proof.signedPayload.agentId !== agentId ||
      (linkId && proof.signedPayload.id !== linkId) ||
      (hash && proof.signedPayload.agentMetadataHash !== hash)
    )
      return false;
    return (
      (
        await recoverTypedDataAddress({ ...t, signature: proof.signature })
      ).toLowerCase() === actor
    );
  } catch {
    return false;
  }
}
export class PersonalAgentService extends PlatformService {
  constructor(options) {
    super({
      ...options,
      repository:
        options.repository || new PersonalAgentRepository(options.env),
    });
    this.registryClientFactory = options.registryClientFactory;
  }
  async context(action, p, actor) {
    let link = null,
      a;
    if (
      action === "identity.link" ||
      action === "identity.verify.wallet" ||
      action === "identity.verify.registration" ||
      action === "identity.wallet.revoke"
    )
      a = await this.repository.agent(p.agentId, true, actor);
    else {
      link = await this.repository.link(p.id, actor);
      if (!link)
        throw new ApiError(404, "LINK_NOT_FOUND", "Association not found");
      a = {
        id: link.agent_id,
        controller: link.profile_controller,
        name: link.name,
        metadata: link.metadata,
        revision: link.profile_revision,
        published: link.published,
      };
    }
    if (!a)
      throw new ApiError(404, "AGENT_NOT_FOUND", "Agent profile not found");
    if (
      (p.agentRevision !== undefined && p.agentRevision !== a.revision) ||
      (link && p.revision !== link.revision)
    )
      throw new ApiError(
        409,
        "REVISION",
        "Profile or association changed; reload",
      );
    if (
      action === "identity.link" &&
      p.controller.toLowerCase() !== expectedController(a)
    )
      throw new ApiError(
        403,
        "CONTROLLER",
        "Use the controller declared in the signed profile",
      );
    if (link) {
      if (["revoked", "disconnected"].includes(link.status))
        throw new ApiError(
          409,
          "LINK_REVOKED",
          "Association was disconnected or revoked",
        );
      if (
        action === "identity.link.confirm"
          ? actor !== link.controller
          : actor !== link.owner
      )
        throw new ApiError(
          403,
          "LINK_ACTOR",
          "This wallet cannot authorize the association action",
        );
      if (
        action !== "identity.link.refresh" &&
        !["identity.link.revoke", "identity.link.disconnect"].includes(
          action,
        ) &&
        link.agent_revision !== a.revision
      )
        throw new ApiError(
          409,
          "STALE_PROFILE",
          "Refresh the association after a profile update",
        );
    }
    if (
      action === "identity.verify.wallet" &&
      (actor !== p.wallet.toLowerCase() ||
        !(a.metadata.services || []).some(
          (s) =>
            s.price?.payTo.toLowerCase() === actor &&
            s.price.network === p.network,
        ))
    )
      throw new ApiError(
        403,
        "RECEIVER_CONTROL",
        "A signature from the declared receiving wallet is required",
      );
    if (action === "identity.verify.registration" && a.controller !== actor)
      throw new ApiError(
        403,
        "PROFILE_OWNER",
        "The profile wallet must authorize the registry check",
      );
    if (
      action === "identity.wallet.revoke" &&
      a.controller !== actor &&
      p.wallet.toLowerCase() !== actor
    )
      throw new ApiError(
        403,
        "RECEIVER_CONTROL",
        "Only the profile or receiving wallet can revoke this proof",
      );
    return { a, link };
  }
  async challenge(actor, action, input) {
    if (!identitySchemas[action]) return super.challenge(actor, action, input);
    if (!identityEnabled(this.env))
      throw new ApiError(
        503,
        "IDENTITY_DISABLED",
        "Personal Agent linking is disabled",
      );
    actor = actor.toLowerCase();
    const payload = identitySchemas[action].parse(input),
      { a, link } = await this.context(action, payload, actor);
    if (action === "identity.verify.registration" && !a.metadata.registration)
      throw new ApiError(
        422,
        "REGISTRATION",
        "Declare an ERC-8004 registration first",
      );
    Object.assign(payload, {
      agentId: a.id,
      agentMetadataHash: metadataHash(a),
      agentSummary: summary(a),
    });
    let endpointControl = null;
    if (action === "identity.verify.endpoint") {
      const origin = new URL(payload.endpointUrl).origin;
      if (!link.origins.includes(origin))
        throw new ApiError(
          422,
          "ENDPOINT",
          "Endpoint origin is not declared in this association",
        );
      endpointControl = {
        ...endpointProofRequest(this.origin, a.id, payload.endpointUrl),
        type: "walletface.personal-agent-endpoint/1",
        linkId: link.id,
        owner: link.owner,
        controller: link.controller,
      };
      payload.endpointControl = endpointControl;
    }
    const typedData = makeAuthorization(this.origin, actor, action, payload);
    await this.repository.createChallenge(typedData, payload);
    return { typedData, payload, endpointControl };
  }
  async execute(input) {
    const saved = await this.repository.challenge(input.nonce),
      action = saved?.payload?.typedData?.message?.action;
    if (!identitySchemas[action]) return super.execute(input);
    if (!identityEnabled(this.env))
      throw new ApiError(
        503,
        "IDENTITY_DISABLED",
        "Personal Agent linking is disabled",
      );
    if (saved.used_at)
      throw new ApiError(409, "REPLAY", "Authorization was already used");
    const typed = saved.payload.typedData,
      payload = input.payload;
    const actor = await verifyAuthorization(
      typed,
      input.signature,
      payload,
      this.origin,
    );
    if (
      typed.message.nonce !== input.nonce ||
      digest(saved.payload.payload) !== digest(payload)
    )
      throw new ApiError(403, "PAYLOAD", "Authorization content changed");
    const base = Object.fromEntries(
      Object.keys(identitySchemas[action].shape)
        .filter((k) => Object.hasOwn(payload, k))
        .map((k) => [k, payload[k]]),
    );
    identitySchemas[action].parse(base);
    const { a, link } = await this.context(action, base, actor);
    if (
      payload.agentId !== a.id ||
      payload.agentMetadataHash !== metadataHash(a) ||
      digest(payload.agentSummary) !== digest(summary(a))
    )
      throw new ApiError(
        409,
        "STALE_PROFILE",
        "Signed profile context changed",
      );
    const data = { ...base, agentId: a.id, origins: declaredOrigins(a) };
    if (action === "identity.verify.endpoint") {
      const c = payload.endpointControl;
      if (
        c.linkId !== link.id ||
        c.owner !== link.owner ||
        c.controller !== link.controller ||
        !link.origins.includes(c.endpointOrigin) ||
        c.expiresAt <= Math.floor(Date.now() / 1000)
      )
        throw new ApiError(
          403,
          "ENDPOINT_PROOF",
          "Endpoint challenge expired or changed",
        );
      const url = c.endpointOrigin + "/.well-known/wallet-face-agent.json";
      const body = await (this.endpointFetcher || fetchPublicJson)(url);
      if (!body || typeof body !== "object" || Array.isArray(body))
        throw new ApiError(
          422,
          "ENDPOINT_JSON",
          "Endpoint proof must be a JSON object",
        );
      for (const k of [
        "type",
        "agentId",
        "linkId",
        "owner",
        "controller",
        "nonce",
        "origin",
      ])
        if (body[k] !== c[k])
          throw new ApiError(
            422,
            "ENDPOINT_PROOF",
            "Publish the exact current personal-agent endpoint proof",
          );
      data.evidence = {
        url: c.endpointOrigin,
        proofUrl: url,
        nonce: c.nonce,
        bodyHash: digest(body),
        checkedAt: new Date().toISOString(),
        status: "domain-control-checked",
        reliability: "not_assessed",
      };
    }
    if (action === "identity.verify.registration")
      data.evidence = await verifyRegistration(
        a.metadata.registration,
        actor,
        this.env,
        this.registryClientFactory,
      );
    const proof = {
      typedData: typed,
      signature: input.signature,
      signedPayload: payload,
      verifiedAt: new Date().toISOString(),
    };
    return this.repository.applyIdentity(
      input.nonce,
      actor,
      action,
      typed.message.payloadHash,
      this.origin,
      data,
      proof,
    );
  }
  async checkedLink(link, a) {
    const hash = metadataHash(a),
      p = link.owner_proof.initial || link.owner_proof,
      latest = link.owner_proof.latest || p;
    const ownerSignature = await historicalProof(p, link.owner, a.id, link.id),
      currentOwnerSignature = await historicalProof(
        latest,
        link.owner,
        a.id,
        link.id,
        hash,
      );
    const controllerSignature =
      !!link.controller_proof &&
      (await historicalProof(
        link.controller_proof,
        link.controller,
        a.id,
        link.id,
        hash,
      ));
    const stale = link.agent_revision !== a.revision,
      active =
        link.status === "active" &&
        !stale &&
        ownerSignature &&
        currentOwnerSignature &&
        controllerSignature;
    return {
      ...link,
      effectiveStatus:
        stale && !["revoked", "disconnected"].includes(link.status)
          ? "stale_profile"
          : link.status,
      verification: {
        ownerSignature,
        currentOwnerSignature,
        controllerSignature,
        activeAssociation: active,
        endpointControl:
          link.origins.length > 0 &&
          link.origins.every((o) =>
            link.endpoint_evidence.some((e) => e.url === o),
          ),
        scope:
          "Wallet signatures and declared endpoint control at recorded times; service reliability and real-world identity are not assessed",
      },
      availability: link.origins.length
        ? "service_availability_unchecked"
        : "local_not_publicly_reachable",
    };
  }
  async identity(a, actor) {
    const record = await this.repository.identity(a.id, actor);
    return {
      schemaVersion: 1,
      agentId: a.id,
      profileWallet: a.controller,
      declaredController: expectedController(a),
      localOnly: declaredOrigins(a).length === 0,
      links: await Promise.all(record.links.map((l) => this.checkedLink(l, a))),
      paymentWallets: await Promise.all(
        record.wallets.map(async (w) => ({
          ...w,
          controlVerified:
            !w.revoked &&
            w.agent_revision === a.revision &&
            (await historicalProof(
              w.proof,
              w.wallet,
              a.id,
              null,
              metadataHash(a),
            )),
          settlementProcessed: false,
        })),
      ),
      registration: record.registration
        ? {
            ...record.registration,
            current: record.registration.agent_revision === a.revision,
          }
        : null,
      capabilitiesStatus: "self_declared",
      serviceDelivery: "not_attested",
    };
  }
}
