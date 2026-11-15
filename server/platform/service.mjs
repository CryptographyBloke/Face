import { recoverTypedDataAddress, createPublicClient, http } from "viem";
import { mainnet } from "viem/chains";
import { PlatformRepository } from "./repository.mjs";
import {
  platformSchemas,
  actionContent,
  parsePlatformPayload,
} from "./schemas.mjs";
import {
  makeAuthorization,
  verifyAuthorization,
  digest,
  issueSession,
  platformTypes,
} from "./authorization.mjs";
import { createToolRegistry, toolSchemas } from "../ai/tools.mjs";
import { endpointProofRequest, checkEndpointProof } from "./endpoint-proof.mjs";
import { ApiError } from "../validation.mjs";
const coreKeys = [
  "id",
  "name",
  "description",
  "avatar",
  "capabilities",
  "endpoints",
  "registry",
  "organizations",
  "published",
];
const core = (p) => Object.fromEntries(coreKeys.map((k) => [k, p[k]]));
export async function checkedAgent(record) {
  const proof = record.proof?.metadataProof || record.proof;
  let controllerVerified = false,
    metadataSignatureVerified = false;
  try {
    const signer = await recoverTypedDataAddress({
      ...proof.typedData,
      signature: proof.signature,
    });
    const m = proof.typedData.message;
    controllerVerified =
      signer.toLowerCase() === record.controller &&
      m.actor.toLowerCase() === record.controller &&
      proof.signedPayload.id === record.id &&
      digest(proof.signedPayload) === m.payloadHash &&
      proof.typedData.domain.name === "Wallet Face Agent Platform" &&
      proof.typedData.domain.chainId === 1 &&
      proof.typedData.domain.version === "1" &&
      proof.typedData.primaryType === "Authorization" &&
      digest(proof.typedData.types) === digest(platformTypes) &&
      ["agent.register", "agent.update"].includes(m.action) &&
      proof.typedData.domain.salt ===
        makeAuthorization(
          m.origin,
          record.controller,
          m.action,
          proof.signedPayload,
        ).domain.salt;
    metadataSignatureVerified =
      controllerVerified &&
      digest(core(proof.signedPayload)) === digest(core(record.metadata));
  } catch {}
  return {
    ...record,
    schemaVersion: 1,
    controllerVerification: {
      verified: controllerVerified,
      metadataSignatureVerified,
      checkedAt: new Date().toISOString(),
      authorizedAt: proof?.verifiedAt || null,
      authorizationExpiresAt: proof?.typedData?.message?.expiresAt
        ? new Date(
            Number(proof.typedData.message.expiresAt) * 1000,
          ).toISOString()
        : null,
      recordUpdatedAt: record.updated_at,
    },
    verificationSemantics:
      "EOA control at signed authorization time; organization entries are self-declared",
    proof: record.proof,
  };
}
export class PlatformService {
  constructor({
    snapshot,
    repository = new PlatformRepository(),
    env = process.env,
    origin,
    endpointFetcher,
  }) {
    Object.assign(this, { snapshot, repository, env, origin, endpointFetcher });
  }
  async admin(spaceId, actor) {
    const space = await this.snapshot.space(spaceId, true);
    if (!space.admins.some((a) => a.toLowerCase() === actor))
      throw new ApiError(
        403,
        "NOT_ADMIN",
        "A current Snapshot Space administrator signature is required",
      );
    return {
      source: "snapshot.admins",
      spaceId,
      checkedAt: new Date().toISOString(),
    };
  }
  async policy(action, payload, actor) {
    if (action === "organization.configure" || action === "action.prepare")
      return this.admin(payload.spaceId, actor);
    if (action.startsWith("action.")) {
      const a = await this.repository.action(payload.id, actor);
      if (!a) throw new ApiError(404, "ACTION_NOT_FOUND", "Action not found");
      if (
        a.content_hash !== payload.contentHash ||
        a.revision !== payload.revision
      )
        throw new ApiError(409, "REVISION", "Review the latest action content");
      return this.admin(a.space_id, actor);
    }
    if (action === "agent.update" || action.startsWith("agent.verify.")) {
      const a = await this.repository.agent(payload.id, true, actor);
      if (!a || a.controller !== actor)
        throw new ApiError(
          403,
          "CONTROLLER",
          "Current controller authorization required",
        );
      if (a.revision !== payload.revision)
        throw new ApiError(
          409,
          "REVISION",
          "Agent profile changed; reload before signing",
        );
    }
    return null;
  }
  async challenge(actor, action, input) {
    if (!platformSchemas[action])
      throw new ApiError(400, "ACTION", "Unsupported platform action");
    const payload = parsePlatformPayload(action, input);
    actor = actor.toLowerCase();
    await this.policy(action, payload, actor);
    const typedData = makeAuthorization(this.origin, actor, action, payload);
    let endpointControl = null;
    if (action === "agent.verify.endpoint") {
      const a = await this.repository.agent(payload.id, true, actor);
      if (!a.metadata.endpoints.some((e) => e.url === payload.endpointUrl))
        throw new ApiError(
          422,
          "ENDPOINT",
          "Endpoint is not declared in this profile",
        );
      endpointControl = endpointProofRequest(
        this.origin,
        payload.id,
        payload.endpointUrl,
      );
      payload.endpointControl = endpointControl;
      typedData.message.payloadHash = digest(payload);
    }
    await this.repository.createChallenge(typedData, payload);
    return { typedData, payload, endpointControl };
  }
  async execute({ nonce, signature, payload }) {
    const saved = await this.repository.challenge(nonce);
    if (!saved || saved.used_at)
      throw new ApiError(
        409,
        "REPLAY",
        "Authorization already used or unavailable",
      );
    const typed = saved.payload.typedData;
    const action = typed.message.action;
    const actor = await verifyAuthorization(
      typed,
      signature,
      payload,
      this.origin,
    );
    if (
      typed.message.nonce !== nonce ||
      digest(saved.payload.payload) !== digest(payload)
    )
      throw new ApiError(403, "PAYLOAD", "Challenge content changed");
    // Schemas are applied again; endpointControl is exclusively the server-issued saved value.
    const base =
      action === "agent.verify.endpoint"
        ? Object.fromEntries(
            Object.entries(payload).filter(([k]) => k !== "endpointControl"),
          )
        : payload;
    parsePlatformPayload(action, base);
    const authority = await this.policy(action, payload, actor);
    let prepared = { ...payload };
    const proof = {
      typedData: typed,
      signature,
      signedPayload: payload,
      authority,
      verifiedAt: new Date().toISOString(),
    };
    if (action === "agent.register" || action === "agent.update") {
      proof.metadataProof = {
        typedData: typed,
        signature,
        signedPayload: payload,
        verifiedAt: proof.verifiedAt,
      };
      const previous =
        action === "agent.update"
          ? await this.repository.agent(payload.id, true, actor)
          : null;
      prepared = {
        ...payload,
        organizationClaims: payload.organizations.map((o) => ({
          ...o,
          status: "self_declared",
        })),
        endpointVerification: (
          previous?.metadata.endpointVerification || []
        ).filter((v) =>
          payload.endpoints.some((e) => new URL(e.url).origin === v.url),
        ),
        registryVerification:
          previous &&
          digest(previous.metadata.registry) === digest(payload.registry)
            ? previous.metadata.registryVerification
            : null,
      };
    }
    if (action.startsWith("agent.verify.")) {
      const previous = await this.repository.agent(payload.id, true, actor);
      proof.metadataProof = previous.proof.metadataProof || previous.proof;
      prepared = { ...previous.metadata, revision: payload.revision };
      if (action === "agent.verify.endpoint") {
        const verified = await checkEndpointProof(
          payload.endpointControl,
          actor,
          this.endpointFetcher,
        );
        prepared.endpointVerification = [
          ...(previous.metadata.endpointVerification || []).filter(
            (p) => p.url !== verified.url,
          ),
          verified,
        ];
      } else {
        if (!previous.metadata.registry || !this.env.ENS_RPC_URL)
          throw new ApiError(
            503,
            "REGISTRY_RPC",
            "A trusted Ethereum RPC and registry reference are required",
          );
        const client = createPublicClient({
          chain: mainnet,
          transport: http(this.env.ENS_RPC_URL, {
            timeout: 6000,
            retryCount: 0,
          }),
        });
        const block = await client.getBlockNumber();
        const ref = previous.metadata.registry;
        const owner = await client.readContract({
          address: ref.registryAddress,
          abi: [
            {
              type: "function",
              name: "ownerOf",
              stateMutability: "view",
              inputs: [{ name: "tokenId", type: "uint256" }],
              outputs: [{ name: "owner", type: "address" }],
            },
          ],
          functionName: "ownerOf",
          args: [BigInt(ref.tokenId)],
          blockNumber: block,
        });
        if (owner.toLowerCase() !== actor)
          throw new ApiError(
            422,
            "REGISTRY_OWNER",
            "Registry token owner differs from the controller",
          );
        prepared.registryVerification = {
          status: "token-owner-verified",
          standardConformance: "not_checked",
          chainId: 1,
          registryAddress: ref.registryAddress,
          tokenId: ref.tokenId,
          checkedBlock: block.toString(),
          owner,
          checkedAt: new Date().toISOString(),
          sourceUrl: `https://etherscan.io/token/${ref.registryAddress}?a=${ref.tokenId}`,
        };
      }
    }
    if (action === "report.save") {
      const registry = createToolRegistry({
        snapshot: this.snapshot,
        maxCalls: 3,
      });
      prepared.evidence = [];
      for (const t of payload.tools) {
        toolSchemas[t.name].parse(t.input);
        if (t.input.spaceId !== payload.spaceId)
          throw new ApiError(
            422,
            "REPORT_SPACE",
            "Report tools must use the selected Space",
          );
        prepared.evidence.push(await registry.run(t.name, t.input));
      }
    }
    if (action === "action.prepare") {
      prepared.content = actionContent[payload.kind].parse(payload.content);
      prepared.contentHash = digest({
        spaceId: payload.spaceId,
        kind: payload.kind,
        content: prepared.content,
      });
    }
    const result = await this.repository.apply(
      nonce,
      actor,
      action,
      typed.message.payloadHash,
      this.origin,
      prepared,
      proof,
    );
    if (action === "session.create")
      return {
        ...result,
        actor,
        token: issueSession(actor, this.origin, this.env),
        expiresIn: 900,
      };
    return result;
  }
}
