import { z } from "zod";
import { ApiError } from "../validation.mjs";
import { sessionActor } from "../platform/authorization.mjs";
import { boundedJson } from "../platform/api.mjs";
import { RunService } from "./runs.mjs";
import { approvalInput, categories } from "./schemas.mjs";
export function createExecutionApi({
  snapshot,
  origin,
  env = process.env,
  service,
}) {
  let current = service;
  return async (request, ip = "local") => {
    const u = new URL(request.url),
      parts = u.pathname.split("/").filter(Boolean),
      json = (value, status = 200) =>
        Response.json(value, {
          status,
          headers: {
            "Cache-Control": "no-store",
            "X-Content-Type-Options": "nosniff",
          },
        });
    try {
      if (u.pathname === "/v1/marketplace/status" && request.method === "GET")
        return json({
          enabled: env.FACE_EXECUTION_ENABLED === "true",
          readOnlyResearch: true,
          protocols: ["internal", "mcp", "a2a"],
          categories,
          accessDays: 30,
          retainedTaskCapacity: 300,
          publicResearchTaskCapacity: 100,
          mainnetEnabled: false,
        });
      if (env.FACE_EXECUTION_ENABLED !== "true" && !service)
        throw new ApiError(
          503,
          "EXECUTION_DISABLED",
          "Agent execution is not enabled",
        );
      current ||= new RunService({ snapshot, origin, env });
      const actor = () =>
        request.headers.has("authorization")
          ? sessionActor(request, origin, env)
          : null;
      if (request.method === "GET" && parts[1] === "marketplace") {
        if (parts[2] === "services" && parts.length === 3) {
          const q = z
            .object({
              q: z.string().max(100).optional(),
              category: z.enum(categories).optional(),
              protocol: z.enum(["internal", "mcp", "a2a"]).optional(),
              price: z.enum(["free", "paid"]).optional(),
            })
            .strict()
            .parse(Object.fromEntries(u.searchParams));
          return json({ items: await current.catalog.list(q) });
        }
        if (parts[2] === "services" && parts.length === 4)
          return json(await current.catalog.get(parts[3]));
        if (
          parts[2] === "developer" &&
          parts[3] === "analytics" &&
          parts.length === 4
        ) {
          const days = z.coerce
              .number()
              .int()
              .min(1)
              .max(90)
              .parse(u.searchParams.get("days") || 30),
            owner = actor();
          if (!owner)
            throw new ApiError(
              401,
              "SESSION_REQUIRED",
              "Wallet session required",
            );
          return json({
            days,
            items: await current.repository.analytics(owner, days),
            settledRevenue: [],
            revenueScope:
              "No payment activation; declared prices are not income",
          });
        }
      }
      if (parts[1] !== "agent-runs")
        throw new ApiError(404, "NOT_FOUND", "Execution route not found");
      if (request.method === "POST") {
        if (request.headers.get("origin") !== origin)
          throw new ApiError(403, "ORIGIN", "Use the application origin");
        const raw = await boundedJson(request, 16000);
        if (parts.length === 2)
          return json(
            await current.create(
              raw,
              actor(),
              ip,
              request.headers.get("x-face-run-token"),
            ),
            201,
          );
        const id = z.string().uuid().parse(parts[2]),
          row = await current.read(
            id,
            actor(),
            request.headers.get("x-face-run-token"),
          );
        if (parts.length === 4 && parts[3] === "cancel") {
          z.object({}).strict().parse(raw);
          return json(await current.cancel(row, { signal: request.signal }));
        }
        if (parts.length === 4 && parts[3] === "poll") {
          z.object({}).strict().parse(raw);
          await current.repository.reserve(ip, env.FACE_SESSION_SECRET);
          return json(await current.poll(row, { signal: request.signal }));
        }
        if (parts.length === 4 && parts[3] === "execute") {
          const approved = approvalInput.parse(raw),
            abort = new AbortController(),
            signal = AbortSignal.any([
              request.signal,
              abort.signal,
              AbortSignal.timeout(45000),
            ]);
          let closed = false;
          return new Response(
            new ReadableStream({
              async start(writer) {
                const emit = (e) => {
                  if (!closed)
                    writer.enqueue(
                      new TextEncoder().encode(JSON.stringify(e) + "\n"),
                    );
                };
                try {
                  const run = await current.execute(row, approved.planHash, {
                    signal,
                    emit,
                    clientIp: ip,
                  });
                  emit({ kind: "done", run });
                } catch (e) {
                  emit({
                    kind: "error",
                    code: e instanceof ApiError ? e.code : "EXECUTION_FAILED",
                    message:
                      e instanceof ApiError ? e.message : "Execution failed",
                  });
                } finally {
                  if (!closed) {
                    closed = true;
                    writer.close();
                  }
                }
              },
              cancel() {
                closed = true;
                abort.abort();
              },
            }),
            {
              headers: {
                "Content-Type": "application/x-ndjson; charset=utf-8",
                "Cache-Control": "no-store",
                "X-Content-Type-Options": "nosniff",
              },
            },
          );
        }
      }
      if (request.method === "GET" && parts.length === 3) {
        const id = z.string().uuid().parse(parts[2]),
          row = await current.read(
            id,
            actor(),
            request.headers.get("x-face-run-token"),
          );
        return json({
          ...current.view(row),
          events: await current.repository.events(id),
        });
      }
      throw new ApiError(404, "NOT_FOUND", "Execution route not found");
    } catch (e) {
      return json(
        {
          error: {
            code:
              e instanceof ApiError
                ? e.code
                : e instanceof z.ZodError
                  ? "VALIDATION"
                  : "EXECUTION_ERROR",
            message:
              e instanceof ApiError
                ? e.message
                : e instanceof z.ZodError
                  ? "Invalid task request"
                  : "Execution request failed",
          },
        },
        e instanceof ApiError ? e.status : e instanceof z.ZodError ? 400 : 500,
      );
    }
  };
}
