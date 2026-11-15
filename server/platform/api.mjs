import { InteropService, interopEnabled } from "../interop/service.mjs";
import { scheduledRefresh } from "./scheduler.mjs";
import { createHash } from "node:crypto";
import { GovernanceIndex } from "./indexer.mjs";
import { z } from "zod";
import { PersonalAgentService, identityEnabled } from "../personal/service.mjs";
import { PlatformService, checkedAgent } from "./service.mjs";
import { sessionActor } from "./authorization.mjs";
import { ApiError, address, spaceId } from "../validation.mjs";
export async function boundedJson(request, max = 32000) {
  const reader = request.body?.getReader();
  if (!reader) throw new ApiError(400, "JSON", "JSON body required");
  let size = 0;
  const chunks = [];
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > max) {
        await reader.cancel();
        throw new ApiError(413, "BODY_SIZE", "Request too large");
      }
      chunks.push(Buffer.from(value));
    }
  } finally {
    reader.releaseLock();
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch {
    throw new ApiError(400, "JSON", "Invalid JSON");
  }
}
export function platformStatus(env = process.env) {
  return {
    version: 1,
    available:
      env.FACE_PLATFORM_ENABLED === "true" &&
      !!env.FACE_DATABASE_URL &&
      env.FACE_SESSION_SECRET?.length >= 32,
    capabilities: [
      "agent-profiles",
      "signed-reports",
      "organization-workspaces",
      "reviewed-actions",
      "public-mcp",
    ],
    walletApprovalRequired: true,
    chatStored: false,
    personalAgents: identityEnabled(env),
    serviceDiscovery: interopEnabled(env),
  };
}
export function createPlatformApi({
  snapshot,
  origin,
  env = process.env,
  service,
}) {
  let current = service;
  return async (request, ip = "local") => {
    const u = new URL(request.url),
      path = u.pathname
        .slice("/v1/platform".length)
        .split("/")
        .filter(Boolean)
        .map(decodeURIComponent);
    const json = (data, status = 200) =>
      Response.json(data, {
        status,
        headers: {
          "Cache-Control": "no-store",
          "X-Content-Type-Options": "nosniff",
        },
      });
    try {
      if (request.method === "GET" && path[0] === "status")
        return json(platformStatus(env));
      if (!platformStatus(env).available && !service)
        throw new ApiError(
          503,
          "PLATFORM_DISABLED",
          "Agent platform is unavailable",
        );
      current ||= new InteropService({ snapshot, origin, env });
      const repo = current.repository;
      const index = new GovernanceIndex({ snapshot, db: repo.db });
      const reserve = async (kind, ip, max = 10) => {
        if (!repo.db) return;
        const hour = Math.floor(Date.now() / 3600000);
        const hash = createHash("sha256")
          .update(env.FACE_SESSION_SECRET + ip)
          .digest("hex")
          .slice(0, 24);
        const r = await repo.db.query(
          `SELECT face_platform.reserve_quota($1::text[],$2::bigint[],now()+interval '2 hours') AS ok`,
          [
            [`platform:${kind}:${hour}`, `platform:${kind}:${hour}:${hash}`],
            [100, max],
          ],
        );
        if (!r[0]?.ok)
          throw new ApiError(
            429,
            "PLATFORM_QUOTA",
            "Platform request quota reached; retry later",
          );
      };
      const actor = () => sessionActor(request, origin, env);
      const optionalActor = () =>
        request.headers.has("authorization") ? actor() : null;
      const uuid = (v) => z.string().uuid().parse(v);
      if (request.method === "POST") {
        if (request.headers.get("origin") !== origin)
          throw new ApiError(403, "ORIGIN", "Use the application origin");
        await reserve("write", ip, 20);
        const raw = await boundedJson(request);
        if (path[0] === "index" && path.length === 2) {
          const id = spaceId(path[1]);
          await current.admin(id, actor());
          return json(await index.refresh(id));
        }
        if (path[0] === "challenge" && path.length === 1) {
          const b = z
            .object({
              actor: z.string(),
              action: z.string().max(80),
              payload: z.unknown(),
            })
            .strict()
            .parse(raw);
          return json(
            await current.challenge(address(b.actor), b.action, b.payload),
          );
        }
        if (path[0] === "execute" && path.length === 1) {
          const b = z
            .object({
              nonce: z.string().regex(/^0x[0-9a-f]{64}$/),
              signature: z.string().regex(/^0x[0-9a-fA-F]{130}$/),
              payload: z.unknown(),
            })
            .strict()
            .parse(raw);
          return json(await current.execute(b));
        }
      }
      if (request.method === "GET") {
        if (
          identityEnabled(env) &&
          path[0] === "my-agents" &&
          path.length === 1
        ) {
          const currentActor = actor();
          const links = await repo.myAgents(currentActor);
          return json({
            items: await Promise.all(
              links.map((l) =>
                current.checkedLink(l, {
                  id: l.agent_id,
                  controller: l.profile_controller,
                  name: l.name,
                  metadata: l.metadata,
                  revision: l.profile_revision,
                }),
              ),
            ),
          });
        }
        if (identityEnabled(env) && path[0] === "links" && path.length === 2) {
          const l = await repo.link(uuid(path[1]), actor());
          if (!l) throw new ApiError(404, "NOT_FOUND", "Association not found");
          return json(
            await current.checkedLink(l, {
              id: l.agent_id,
              controller: l.profile_controller,
              name: l.name,
              metadata: l.metadata,
              revision: l.profile_revision,
            }),
          );
        }
        if (
          identityEnabled(env) &&
          path[0] === "agents" &&
          path.length === 3 &&
          path[2] === "identity"
        ) {
          const a = await repo.agent(uuid(path[1]), true, optionalActor());
          if (!a) throw new ApiError(404, "NOT_FOUND", "Agent not found");
          return json(await current.identity(a, optionalActor()));
        }

        if (path[0] === "refresh" && path.length === 1)
          return json(
            await scheduledRefresh(request, {
              env,
              repository: repo,
              index,
              snapshot,
            }),
          );
        if (path[0] === "analytics" && path.length === 2) {
          const q = {};
          for (const k of ["start", "end", "compareStart", "compareEnd"])
            if (u.searchParams.has(k)) q[k] = Number(u.searchParams.get(k));
          return json(await index.analyze(spaceId(path[1]), q));
        }
        if (path[0] === "agents" && path.length === 1)
          return json({
            items: await Promise.all(
              (
                await repo.agents((u.searchParams.get("q") || "").slice(0, 100))
              ).map(checkedAgent),
            ),
          });
        if (path[0] === "agents" && path.length >= 2) {
          const a = await repo.agent(uuid(path[1]), true, optionalActor());
          if (!a) throw new ApiError(404, "NOT_FOUND", "Agent not found");
          const checked = await checkedAgent(a);
          if (path.length === 2) return json(checked);
          if (path[2] === "card" && path.length === 3)
            return json({
              schemaVersion: "walletface.agent-discovery/1",
              agentId: a.id,
              name: a.name,
              description: a.metadata.description,
              controller: a.controller,
              declaredServices: a.metadata.endpoints,
              capabilities: a.metadata.capabilities,
              verification: checked.controllerVerification,
              profileUrl: origin + "/agents/" + a.id,
              notice:
                "Service declarations only. A2A Agent Card URLs must point to operator-hosted conformant cards; Wallet Face does not proxy A2A execution.",
            });
        }
        if (
          interopEnabled(env) &&
          path[0] === "agents" &&
          path.length === 3 &&
          path[2] === "discovery"
        ) {
          const a = await repo.agent(uuid(path[1]), true, optionalActor());
          if (!a) throw new ApiError(404, "NOT_FOUND", "Agent not found");
          return json(await current.manifest(a, optionalActor()));
        }
        if (path[0] === "workspace" && path.length === 1)
          return json(await repo.workspace(actor()));
        if (path[0] === "reports" && path.length === 2) {
          const r = await repo.report(uuid(path[1]), optionalActor());
          if (!r) throw new ApiError(404, "NOT_FOUND", "Report not found");
          return json(r);
        }
        if (path[0] === "actions" && path.length === 2) {
          const a = await repo.action(uuid(path[1]), actor());
          if (!a) throw new ApiError(404, "NOT_FOUND", "Action not found");
          return json(a);
        }
        if (path[0] === "organizations" && path.length === 2) {
          const id = spaceId(path[1]);
          return json({
            organization: await repo.organization(id),
            records: await repo.records(id),
          });
        }
        if (path[0] === "audit" && path.length === 2)
          return json({
            items: await repo.audit(path[1].slice(0, 100), actor()),
          });
      }
      throw new ApiError(404, "NOT_FOUND", "Platform route not found");
    } catch (e) {
      return json(
        {
          error: {
            code:
              e instanceof ApiError
                ? e.code
                : e instanceof z.ZodError
                  ? "VALIDATION"
                  : "PLATFORM_ERROR",
            message:
              e instanceof ApiError
                ? e.message
                : e instanceof z.ZodError
                  ? "Invalid platform request"
                  : "Platform request failed",
          },
        },
        e instanceof ApiError
          ? e.status
          : e instanceof z.ZodError || e instanceof URIError
            ? 400
            : 500,
      );
    }
  };
}
