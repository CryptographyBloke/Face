import { researchArguments } from "./window.mjs";
import { digest } from "../platform/authorization.mjs";
import { ApiError } from "../validation.mjs";
import { z } from "zod";
import { randomUUID } from "node:crypto";
import { platformDb } from "../platform/db.mjs";
import { internalResearch, RunRepository } from "./runs.mjs";
import { boundedJson } from "../platform/api.mjs";
// Public compatibility service: stores public governance facts only. Caller text,
// wallet identity and private run credentials are never retained or reflected.
export function createResearchAgent({
  snapshot,
  origin,
  env = process.env,
  db,
}) {
  let current = db;
  return async (request, ip = "local") => {
    const u = new URL(request.url);
    if (env.FACE_EXECUTION_ENABLED !== "true")
      return Response.json(
        { error: "Research execution disabled" },
        { status: 503 },
      );
    if (request.method === "GET" && u.pathname === "/v1/research-agent/card")
      return Response.json({
        name: "Wallet Face Public Governance Research",
        description:
          "Public Snapshot governance research only. Request text is not stored. Completed public-data artifacts can be retrieved by task ID for one day.",
        version: "1.0.0",
        supportedInterfaces: [
          {
            url: origin + "/v1/research-agent/rpc",
            protocolBinding: "JSONRPC",
            protocolVersion: "1.0",
          },
        ],
        capabilities: { streaming: false },
        defaultInputModes: ["text/plain", "application/json"],
        defaultOutputModes: ["text/plain", "application/json"],
        skills: [
          {
            id: "governance_research",
            name: "Public governance research",
            description:
              "Compute observed Snapshot participation with provenance.",
            tags: ["governance", "read-only"],
          },
        ],
      });
    let id = null;
    try {
      if (request.method !== "POST" || u.pathname !== "/v1/research-agent/rpc")
        throw Error("Method");
      const b = z
        .object({
          jsonrpc: z.literal("2.0"),
          id: z.union([z.string().max(100), z.number()]),
          method: z.enum(["SendMessage", "GetTask", "CancelTask"]),
          params: z.record(z.string(), z.unknown()),
        })
        .strict()
        .parse(await boundedJson(request, 16000));
      id = b.id;
      current ||= platformDb(env);
      await new RunRepository(env, current).reserve(
        "a2a:" + ip,
        env.FACE_SESSION_SECRET,
      );
      const render = (r) => ({
        id: r.id,
        contextId: r.id,
        status: {
          state: {
            working: "TASK_STATE_WORKING",
            completed: "TASK_STATE_COMPLETED",
            cancelled: "TASK_STATE_CANCELED",
            failed: "TASK_STATE_FAILED",
          }[r.state],
        },
        artifacts: r.result
          ? [
              {
                artifactId: r.id,
                name: "Public governance report",
                parts: [{ text: r.result.text }, { data: r.result.structured }],
              },
            ]
          : [],
      });
      if (b.method === "SendMessage") {
        if (b.params.configuration?.returnImmediately === true)
          return Response.json({
            jsonrpc: "2.0",
            id,
            error: {
              code: -32004,
              message:
                "This bounded research service supports blocking SendMessage; use returnImmediately=false",
            },
          });
        const message = z
            .object({
              messageId: z.string().uuid(),
              contextId: z.string().uuid().optional(),
              role: z.literal("ROLE_USER"),
              parts: z
                .array(
                  z
                    .object({
                      text: z.string().max(3000).optional(),
                      data: z.record(z.string(), z.unknown()).optional(),
                    })
                    .strict(),
                )
                .min(1)
                .max(3),
            })
            .strict()
            .parse(b.params.message),
          data = message.parts.find((p) => p.data)?.data;
        const declaration = z
          .object({
            capability: z.literal("governance_research"),
            arguments: researchArguments,
          })
          .strict()
          .parse(data);
        const args = declaration.arguments,
          argsHash = digest(args);
        const batches = await current.transaction([
          [
            "SELECT pg_advisory_xact_lock(hashtextextended('face_execution_storage',0))",
          ],
          [
            "INSERT INTO face_platform.public_research_tasks(id,space_id,args_hash,state) SELECT $1::uuid,$2,$3,'working' WHERE (SELECT count(*) FROM face_platform.public_research_tasks)<100 ON CONFLICT DO NOTHING RETURNING *",
            [message.messageId, args.spaceId, argsHash],
          ],
        ]);
        const inserted = batches[1];
        if (!inserted[0]) {
          const r = (
            await current.query(
              "SELECT * FROM face_platform.public_research_tasks WHERE id=$1::uuid AND space_id=$2 AND args_hash=$3 AND expires_at>now()",
              [message.messageId, args.spaceId, argsHash],
            )
          )[0];
          if (!r)
            throw new ApiError(
              429,
              "RESEARCH_CAPACITY",
              "Task ID conflicts or retained public task capacity reached",
            );
          return Response.json({
            jsonrpc: "2.0",
            id,
            result: { task: render(r) },
          });
        }
        try {
          const result = await internalResearch(snapshot, args, {
            signal: AbortSignal.any([
              request.signal,
              AbortSignal.timeout(25000),
            ]),
          });
          const rows = await current.query(
            "UPDATE face_platform.public_research_tasks SET state='completed',result=$2::jsonb WHERE id=$1::uuid AND state='working' RETURNING *",
            [message.messageId, JSON.stringify(result)],
          );
          const r =
            rows[0] ||
            (
              await current.query(
                "SELECT * FROM face_platform.public_research_tasks WHERE id=$1::uuid",
                [message.messageId],
              )
            )[0];
          return Response.json({
            jsonrpc: "2.0",
            id,
            result: { task: render(r) },
          });
        } catch (e) {
          await current.query(
            "UPDATE face_platform.public_research_tasks SET state='failed' WHERE id=$1::uuid AND state='working'",
            [message.messageId],
          );
          throw e;
        }
      }
      const taskId = z.string().uuid().parse(b.params.id),
        rows =
          b.method === "CancelTask"
            ? await current.query(
                "UPDATE face_platform.public_research_tasks SET state='cancelled' WHERE id=$1::uuid AND state='working' AND expires_at>now() RETURNING *",
                [taskId],
              )
            : await current.query(
                "SELECT * FROM face_platform.public_research_tasks WHERE id=$1::uuid AND expires_at>now()",
                [taskId],
              );
      if (!rows[0])
        return Response.json({
          jsonrpc: "2.0",
          id,
          error: {
            code: -32001,
            message: "Task not found or no longer cancellable",
          },
        });
      return Response.json({ jsonrpc: "2.0", id, result: render(rows[0]) });
    } catch (error) {
      return Response.json(
        {
          jsonrpc: "2.0",
          id,
          error: {
            code: error instanceof ApiError ? -32000 : -32602,
            message:
              error instanceof ApiError
                ? error.message
                : "Invalid or unavailable public research task",
          },
        },
        { status: error instanceof ApiError ? error.status : 400 },
      );
    }
  };
}
