import https from "node:https";
import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import {
  Client,
  StreamableHTTPClientTransport,
} from "@modelcontextprotocol/client";
import { z } from "zod";
import { fetchPublicJson, publicIp } from "../platform/endpoint-proof.mjs";
import { ApiError } from "../validation.mjs";
import { digest } from "../platform/authorization.mjs";
const httpsUrl = z
  .string()
  .max(2048)
  .url()
  .refine((v) => {
    const u = new URL(v);
    return (
      u.protocol === "https:" &&
      !u.username &&
      !u.password &&
      !u.hash &&
      (!u.port || u.port === "443")
    );
  });
export const agentCardSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(4000),
  version: z.string().max(100),
  supportedInterfaces: z
    .array(
      z.object({
        url: httpsUrl,
        protocolBinding: z.enum(["JSONRPC", "HTTP+JSON", "GRPC"]),
        protocolVersion: z.string().regex(/^1\.0(?:\.\d+)?$/),
      }),
    )
    .min(1)
    .max(10),
  capabilities: z.record(z.string(), z.unknown()),
  defaultInputModes: z.array(z.string().max(100)).max(20),
  defaultOutputModes: z.array(z.string().max(100)).max(20),
  skills: z
    .array(
      z.object({
        id: z.string().max(100),
        name: z.string().max(100),
        description: z.string().max(2000),
        tags: z.array(z.string().max(100)).max(30),
      }),
    )
    .max(50),
});
export async function probeA2a(url, fetcher = fetchPublicJson) {
  const body = await fetcher(url),
    card = agentCardSchema.parse(body);
  return {
    protocol: "a2a",
    status: "metadata_checked",
    sourceUrl: url,
    checkedAt: new Date().toISOString(),
    bodyHash: digest(body),
    card,
    claims: "operator_declared",
    signatureVerification: "not_checked",
    taskExecution: false,
    reliability: "not_assessed",
  };
}
/** Pinned DNS/TLS, no redirects/credentials, POST-only MCP metadata transport. */
export async function pinnedMcpFetch(input, init = {}, options = {}) {
  const url = new URL(String(input)),
    resolve = options.resolve || lookup,
    request = options.request || https.request;
  if (
    url.protocol !== "https:" ||
    url.username ||
    url.password ||
    url.hash ||
    (url.port && url.port !== "443") ||
    isIP(url.hostname) ||
    url.hostname === "localhost" ||
    url.hostname.endsWith(".localhost")
  )
    throw new ApiError(422, "MCP_URL", "Use a public HTTPS MCP hostname");
  if (init.method !== "POST") return new Response(null, { status: 405 });
  const text = String(init.body || "");
  let rpc;
  try {
    rpc = JSON.parse(text);
  } catch {
    throw new ApiError(422, "MCP_BODY", "MCP metadata request must be JSON");
  }
  if (
    text.length > 8192 ||
    !["initialize", "notifications/initialized", "tools/list"].includes(
      rpc.method,
    )
  )
    throw new ApiError(
      403,
      "MCP_READ_ONLY",
      "Only initialization and tools/list metadata are permitted",
    );
  let dnsTimer;
  const started = Date.now(),
    records = await Promise.race([
      resolve(url.hostname, { all: true, verbatim: true }),
      new Promise((_, reject) => {
        dnsTimer = setTimeout(
          () =>
            reject(
              new ApiError(504, "MCP_TIMEOUT", "MCP DNS lookup timed out"),
            ),
          5000,
        );
      }),
    ]).finally(() => clearTimeout(dnsTimer));
  if (!records.length || records.some((r) => !publicIp(r.address)))
    throw new ApiError(
      422,
      "MCP_NETWORK",
      "MCP endpoint resolves to a restricted network",
    );
  const selected = records[0],
    incoming = new Headers(init.headers),
    headers = {
      "Content-Type": "application/json",
      Accept: "application/json, text/event-stream",
      "User-Agent": "WalletFace-Discovery/1",
    };
  for (const name of ["mcp-protocol-version", "mcp-session-id"]) {
    const value = incoming.get(name);
    if (value) {
      if (value.length > 256 || !/^[\x20-\x7E]+$/.test(value))
        throw new ApiError(422, "MCP_HEADER", "Invalid MCP metadata header");
      headers[name] = value;
    }
  }
  return new Promise((done, fail) => {
    const req = request(
      url,
      {
        method: "POST",
        headers,
        servername: url.hostname,
        lookup: (_h, o, cb) =>
          o?.all
            ? cb(null, [selected])
            : cb(null, selected.address, selected.family),
      },
      (res) => {
        if (![200, 202, 204, 401, 403, 405].includes(res.statusCode)) {
          res.resume();
          fail(
            new ApiError(
              422,
              "MCP_RESPONSE",
              "MCP response rejected; redirects are disabled",
            ),
          );
          return;
        }
        let size = 0;
        const chunks = [];
        res.on("data", (b) => {
          size += b.length;
          if (size > 32768) {
            req.destroy();
            fail(new ApiError(413, "MCP_SIZE", "MCP metadata exceeds 32 KB"));
          } else chunks.push(b);
        });
        res.on("end", () => {
          const safeHeaders = {};
          for (const name of [
            "content-type",
            "mcp-session-id",
            "mcp-protocol-version",
          ]) {
            const v = res.headers[name];
            if (typeof v === "string" && v.length <= 256) safeHeaders[name] = v;
          }
          done(
            new Response(
              [204, 202].includes(res.statusCode) && size === 0
                ? null
                : Buffer.concat(chunks),
              { status: res.statusCode, headers: safeHeaders },
            ),
          );
        });
      },
    );
    const timer = setTimeout(
        () => req.destroy(new Error("deadline")),
        Math.max(1, 5000 - (Date.now() - started)),
      ),
      stop = () => req.destroy(new Error("cancelled"));
    if (init.signal?.aborted) {
      req.destroy();
      clearTimeout(timer);
      fail(
        new ApiError(499, "MCP_CANCELLED", "MCP metadata request cancelled"),
      );
      return;
    }
    init.signal?.addEventListener("abort", stop, { once: true });
    req.once("close", () => {
      clearTimeout(timer);
      init.signal?.removeEventListener("abort", stop);
    });
    req.on("error", () =>
      fail(new ApiError(502, "MCP_UNAVAILABLE", "MCP metadata request failed")),
    );
    req.end(text);
  });
}
export async function probeMcp(url, { fetcher = pinnedMcpFetch } = {}) {
  const target = new URL(url).href,
    client = new Client({ name: "wallet-face-discovery", version: "1" });
  let posts = 0;
  const transport = new StreamableHTTPClientTransport(new URL(target), {
    fetch: async (input, init) => {
      if (new URL(String(input)).href !== target)
        throw new ApiError(
          403,
          "MCP_ORIGIN",
          "MCP discovery cannot follow another endpoint",
        );
      if (init?.method === "POST" && ++posts > 3)
        throw new ApiError(
          429,
          "MCP_LIMIT",
          "MCP metadata request limit reached",
        );
      return fetcher(input, init);
    },
    reconnectionOptions: { maxRetries: 0 },
  });
  try {
    await client.connect(transport, { timeout: 5000 });
    const list = await client.listTools({}, { timeout: 5000 });
    if (list.tools.length > 50 || list.nextCursor)
      throw new ApiError(
        422,
        "MCP_TOOLS_LIMIT",
        "MCP metadata is paginated or exceeds the 50-tool discovery limit",
      );
    return {
      protocol: "mcp",
      status: "metadata_checked",
      sourceUrl: target,
      checkedAt: new Date().toISOString(),
      sdkVersion: "2.4.0",
      server: client.getServerVersion(),
      tools: list.tools.map((t) => ({
        name: t.name.slice(0, 100),
        description: t.description?.slice(0, 1000) || "",
        declaredReadOnly: t.annotations?.readOnlyHint === true,
      })),
      toolExecution: false,
      claims: "operator_declared",
      reliability: "not_assessed",
    };
  } finally {
    await client.close();
  }
}
