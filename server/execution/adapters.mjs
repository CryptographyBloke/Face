import {
  Client,
  StreamableHTTPClientTransport,
} from "@modelcontextprotocol/client";
import { z } from "zod";
import { randomUUID } from "node:crypto";
import { publicRequest } from "./http.mjs";
import { validateArguments } from "./schemas.mjs";
import { ApiError } from "../validation.mjs";
import { digest } from "../platform/authorization.mjs";
const boundedResult = (value) => {
  if (Buffer.byteLength(JSON.stringify(value)) > 160000)
    throw new ApiError(
      413,
      "RESULT_LIMIT",
      "Agent result exceeds storage budget",
    );
  return value;
};
export async function executeMcp(
  service,
  args,
  { signal, onProgress = async () => {}, fetcher = publicRequest } = {},
) {
  validateArguments(service.inputSchema, args);
  let posts = 0,
    calls = 0;
  const client = new Client({ name: "wallet-face-execution", version: "1" }),
    target = new URL(service.endpointUrl).href;
  const transport = new StreamableHTTPClientTransport(new URL(target), {
    fetch: async (input, init = {}) => {
      if (new URL(String(input)).href !== target)
        throw new ApiError(403, "EXECUTION_TARGET", "Endpoint cannot change");
      if (init.method !== "POST") return new Response(null, { status: 405 });
      const rpc = JSON.parse(String(init.body || "{}"));
      if (
        ++posts > 5 ||
        ![
          "initialize",
          "notifications/initialized",
          "tools/list",
          "tools/call",
          "notifications/cancelled",
        ].includes(rpc.method)
      )
        throw new ApiError(
          403,
          "EXECUTION_METHOD",
          "Remote method is outside the approved task",
        );
      if (
        rpc.method === "tools/call" &&
        (++calls > 1 ||
          rpc.params?.name !== service.capability ||
          digest(rpc.params?.arguments || {}) !== digest(args))
      )
        throw new ApiError(
          403,
          "EXECUTION_TOOL",
          "Only the approved tool and exact arguments may execute once",
        );
      return fetcher(input, {
        ...init,
        signal: AbortSignal.any([
          ...(init.signal ? [init.signal] : []),
          ...(signal ? [signal] : []),
        ]),
      });
    },
    reconnectionOptions: { maxRetries: 0 },
  });
  try {
    await client.connect(transport, { timeout: 10000, signal });
    const list = await client.listTools({}, { timeout: 10000, signal }),
      tool = list.tools.find((t) => t.name === service.capability);
    if (
      !tool ||
      list.nextCursor ||
      list.tools.length > 50 ||
      (!service.platformProvided &&
        digest(tool.inputSchema) !== service.schemaHash)
    )
      throw new ApiError(
        409,
        "CAPABILITY_CHANGED",
        "Tool schema changed; service must be reviewed again",
      );
    await onProgress({ kind: "tool_started", tool: service.capability });
    const result = await client.callTool(
      { name: service.capability, arguments: args },
      {
        timeout: 20000,
        signal,
        toolDefinition: { name: tool.name, inputSchema: service.inputSchema },
      },
    );
    if (result.isError)
      throw new ApiError(502, "TOOL_FAILED", "Remote tool reported failure");
    return boundedResult({
      protocol: "mcp",
      text: (result.content || [])
        .filter((x) => x.type === "text")
        .map((x) => x.text)
        .join("\n")
        .slice(0, 60000),
      structured: result.structuredContent || null,
      sourceUrl: target,
      retrievedAt: new Date().toISOString(),
      untrustedContent: true,
    });
  } finally {
    await client.close();
  }
}
const part = z
  .object({
    text: z.string().max(60000).optional(),
    data: z.record(z.string(), z.unknown()).optional(),
  })
  .passthrough();
const taskSchema = z
  .object({
    id: z.string().min(1).max(200),
    contextId: z.string().max(200).optional(),
    status: z.object({
      state: z.enum([
        "TASK_STATE_SUBMITTED",
        "TASK_STATE_WORKING",
        "TASK_STATE_COMPLETED",
        "TASK_STATE_FAILED",
        "TASK_STATE_CANCELED",
        "TASK_STATE_REJECTED",
        "TASK_STATE_INPUT_REQUIRED",
        "TASK_STATE_AUTH_REQUIRED",
      ]),
      message: z.object({ parts: z.array(part).max(50) }).optional(),
    }),
    artifacts: z
      .array(z.object({ parts: z.array(part).max(50) }).passthrough())
      .max(50)
      .optional(),
  })
  .passthrough();
export async function a2aRpc(
  service,
  method,
  params,
  { signal, fetcher = publicRequest } = {},
) {
  if (!["SendMessage", "GetTask", "CancelTask"].includes(method))
    throw new ApiError(403, "A2A_METHOD", "Unsupported A2A method");
  const id = randomUUID(),
    r = await fetcher(service.endpointUrl, {
      method: "POST",
      headers: { "A2A-Version": "1.0" },
      body: JSON.stringify({ jsonrpc: "2.0", id, method, params }),
      signal,
    });
  if (!r.ok) throw new ApiError(502, "A2A_RESPONSE", "A2A request failed");
  const b = await r.json();
  if (b.jsonrpc !== "2.0" || b.id !== id || b.error || !b.result)
    throw new ApiError(502, "A2A_RESPONSE", "Invalid A2A JSON-RPC response");
  return boundedResult(b.result);
}
export function normalizeA2a(result) {
  if (result.task && result.message)
    throw new ApiError(502, "A2A_RESPONSE", "Ambiguous A2A response");
  if (result.message) {
    const p = z
      .object({ role: z.literal("ROLE_AGENT"), parts: z.array(part).max(50) })
      .passthrough()
      .parse(result.message);
    return {
      state: "completed",
      result: {
        protocol: "a2a",
        text: p.parts.map((p) => p.text || "").join("\n"),
        structured: p.parts.filter((p) => p.data).map((p) => p.data),
        untrustedContent: true,
      },
    };
  }
  const task = taskSchema.parse(result.task || result),
    state = task.status.state;
  if (["TASK_STATE_FAILED", "TASK_STATE_REJECTED"].includes(state))
    throw new ApiError(
      502,
      "A2A_TASK_FAILED",
      "Remote task failed or rejected",
    );
  return {
    remoteTaskId: task.id,
    state:
      state === "TASK_STATE_COMPLETED"
        ? "completed"
        : state === "TASK_STATE_CANCELED"
          ? "cancelled"
          : ["TASK_STATE_INPUT_REQUIRED", "TASK_STATE_AUTH_REQUIRED"].includes(
                state,
              )
            ? "needs_input"
            : "waiting_remote",
    result: {
      protocol: "a2a",
      text: (task.artifacts || [])
        .flatMap((a) => a.parts)
        .map((p) => p.text || "")
        .join("\n")
        .slice(0, 60000),
      structured: task,
      untrustedContent: true,
    },
  };
}
export async function executeA2a(service, input, options = {}) {
  validateArguments(service.inputSchema, input.arguments);
  return normalizeA2a(
    await a2aRpc(
      service,
      "SendMessage",
      {
        message: {
          messageId: input.id,
          contextId: input.id,
          role: "ROLE_USER",
          parts: [
            { text: input.task },
            {
              data: {
                capability: service.capability,
                arguments: input.arguments,
              },
            },
          ],
        },
        configuration: {
          returnImmediately: !service.platformProvided,
          acceptedOutputModes: ["text/plain", "application/json"],
          historyLength: 0,
        },
      },
      options,
    ),
  );
}
