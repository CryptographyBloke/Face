import { PersonalAgentRepository } from "../personal/repository.mjs";
import { PersonalAgentService, identityEnabled } from "../personal/service.mjs";
import { McpServer, createMcpHandler } from "@modelcontextprotocol/server";
import { z } from "zod";
import { createToolRegistry, toolSchemas } from "../ai/tools.mjs";
import { checkedAgent } from "../platform/service.mjs";
import { PlatformRepository } from "../platform/repository.mjs";
export function mcpServer({
  snapshot,
  store = null,
  ens = null,
  repository,
  env = process.env,
  signal,
}) {
  const server = new McpServer(
    { name: "wallet-face", version: "0.5.0" },
    {
      instructions:
        "Read-only public identity and observed governance data. Dataset scope and privacy omissions must accompany interpretations. Organization claims are not membership verification.",
    },
  );
  const tool = (name, description, inputSchema, run) =>
    server.registerTool(
      name,
      {
        description,
        inputSchema,
        annotations: {
          readOnlyHint: true,
          destructiveHint: false,
          idempotentHint: true,
          openWorldHint: false,
        },
      },
      async (input) => {
        try {
          const result = await run(input);
          return {
            content: [{ type: "text", text: JSON.stringify(result) }],
            structuredContent: result,
          };
        } catch {
          return {
            isError: true,
            content: [
              {
                type: "text",
                text: "Public data unavailable or input rejected; no operation was performed.",
              },
            ],
          };
        }
      },
    );
  const registry = () =>
    createToolRegistry({ snapshot, store, ens, signal, maxCalls: 1 });
  tool(
    "resolve_wallet_profile",
    "Resolve public wallet profile; claim verification is separate from external fields.",
    toolSchemas.getWalletProfile,
    (i) => registry().run("getWalletProfile", i),
  );
  tool(
    "get_space",
    "Read public Snapshot Space metadata and provenance.",
    toolSchemas.getSpace,
    (i) => registry().run("getSpace", i),
  );
  tool(
    "list_public_participants",
    "Observed public governance participants; never infer organization membership.",
    toolSchemas.listParticipants,
    (i) => registry().run("listParticipants", i),
  );
  const resolve = async ({ agentId }) => {
    const repo = repository || new PersonalAgentRepository(env);
    const r = await repo.agent(agentId);
    if (!r) throw new Error("Not found");
    const a = await checkedAgent(r);
    if (identityEnabled(env) && typeof repo.identity === "function") {
      const identity = await new PersonalAgentService({
        env,
        origin: "https://walletface.org",
        repository: repo,
      }).identity(r, null);
      a.personalIdentity = {
        schemaVersion: 1,
        profileWallet: identity.profileWallet,
        declaredController: identity.declaredController,
        localOnly: identity.localOnly,
        associations: identity.links
          .slice(0, 10)
          .map((l) => ({
            owner: l.owner,
            controller: l.controller,
            status: l.effectiveStatus,
            verification: l.verification,
            endpointEvidence: l.endpoint_evidence,
          })),
        paymentWallets: identity.paymentWallets.map((w) => ({
          wallet: w.wallet,
          network: w.network,
          controlVerified: w.controlVerified,
          checkedAt: w.checked_at,
          settlementProcessed: false,
        })),
        registration: identity.registration,
      };
    }
    return a;
  };
  tool(
    "get_agent_profile",
    "Read a published Agent profile and checked signature evidence.",
    z.object({ agentId: z.string().uuid() }).strict(),
    resolve,
  );
  tool(
    "verify_identity_claim",
    "Recheck controller/metadata signatures on a published Agent record. Endpoint/registry checks have their own recorded times; no real-world identity assertion.",
    z.object({ agentId: z.string().uuid() }).strict(),
    async (i) => {
      const a = await resolve(i);
      return {
        agentId: a.id,
        controller: a.controller,
        controllerVerification: a.controllerVerification,
        endpointVerification: a.metadata.endpointVerification || [],
        registryVerification: a.metadata.registryVerification || null,
        organizationClaims: a.metadata.organizationClaims || [],
        verificationSemantics: a.verificationSemantics,
        personalIdentity: a.personalIdentity || null,
      };
    },
  );
  return server;
}
export function createPublicMcp(options) {
  const handler = createMcpHandler(
    (ctx) => mcpServer({ ...options, signal: ctx.requestInfo?.signal }),
    { maxRequestBodySize: 16000, maxSubscriptions: 0 },
  );
  return async (request) => {
    const supplied = request.headers.get("origin");
    if (supplied && supplied !== options.origin)
      return Response.json({ error: "Origin not allowed" }, { status: 403 });
    if (request.method !== "POST")
      return new Response(null, { status: 405, headers: { Allow: "POST" } });
    return handler.fetch(request);
  };
}
