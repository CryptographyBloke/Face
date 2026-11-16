import https from "node:https";
import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import { publicIp } from "../platform/endpoint-proof.mjs";
import { ApiError } from "../validation.mjs";
export function endpointUrl(input) {
  const u = new URL(input);
  if (
    u.protocol !== "https:" ||
    u.username ||
    u.password ||
    u.hash ||
    (u.port && u.port !== "443") ||
    isIP(u.hostname) ||
    u.hostname === "localhost" ||
    u.hostname.endsWith(".localhost")
  )
    throw new ApiError(422, "EXECUTION_URL", "Use a public HTTPS hostname");
  return u;
}
// Requests are rebuilt; caller cookies, authentication and redirects are never forwarded.
export async function publicRequest(input, init = {}, options = {}) {
  const url = endpointUrl(String(input)),
    resolve = options.resolve || lookup,
    request = options.request || https.request,
    timeout = options.timeoutMs || 15000;
  const body = String(init.body || "");
  if (Buffer.byteLength(body) > 20000)
    throw new ApiError(413, "REMOTE_INPUT_SIZE", "Remote input is too large");
  const started = Date.now();
  let timer;
  const records = await Promise.race([
    resolve(url.hostname, { all: true, verbatim: true }),
    new Promise((_, reject) => {
      timer = setTimeout(
        () =>
          reject(new ApiError(504, "REMOTE_TIMEOUT", "Remote DNS timed out")),
        Math.min(timeout, 5000),
      );
    }),
  ]).finally(() => clearTimeout(timer));
  if (!records.length || records.some((r) => !publicIp(r.address)))
    throw new ApiError(
      422,
      "EXECUTION_NETWORK",
      "Restricted network destination",
    );
  const selected = records[0],
    incoming = new Headers(init.headers),
    headers = {
      "Content-Type": "application/json",
      Accept: "application/json, application/a2a+json, text/event-stream",
      "User-Agent": "WalletFace-Execution/1",
    };
  for (const k of ["mcp-protocol-version", "mcp-session-id", "a2a-version"]) {
    const v = incoming.get(k);
    if (v) {
      if (v.length > 256 || !/^[\x20-\x7e]+$/.test(v))
        throw new ApiError(422, "REMOTE_HEADER", "Invalid protocol header");
      headers[k] = v;
    }
  }
  return new Promise((done, fail) => {
    const req = request(
      url,
      {
        method: init.method || "POST",
        headers,
        servername: url.hostname,
        lookup: (_h, o, cb) =>
          o?.all
            ? cb(null, [selected])
            : cb(null, selected.address, selected.family),
      },
      (res) => {
        if (![200, 202, 204, 400, 401, 403, 405].includes(res.statusCode)) {
          res.resume();
          fail(
            new ApiError(
              502,
              "REMOTE_RESPONSE",
              "Remote response rejected; redirects are disabled",
            ),
          );
          return;
        }
        const chunks = [];
        let size = 0;
        res.on("data", (chunk) => {
          size += chunk.length;
          if (size > (options.maxBytes || 196608)) {
            req.destroy();
            fail(
              new ApiError(
                413,
                "REMOTE_OUTPUT_SIZE",
                "Remote response exceeds execution budget",
              ),
            );
          } else chunks.push(chunk);
        });
        res.on("end", () => {
          const h = {};
          for (const k of [
            "content-type",
            "mcp-session-id",
            "mcp-protocol-version",
          ])
            if (
              typeof res.headers[k] === "string" &&
              res.headers[k].length < 256
            )
              h[k] = res.headers[k];
          done(
            new Response(size ? Buffer.concat(chunks) : null, {
              status: res.statusCode,
              headers: h,
            }),
          );
        });
      },
    );
    const deadline = setTimeout(
        () => req.destroy(new Error("timeout")),
        Math.max(1, timeout - (Date.now() - started)),
      ),
      stop = () => req.destroy(new Error("cancelled"));
    req.once("close", () => {
      clearTimeout(deadline);
      init.signal?.removeEventListener("abort", stop);
    });
    req.on("error", () =>
      fail(
        new ApiError(
          502,
          "REMOTE_UNAVAILABLE",
          "Remote execution failed or timed out; no automatic retry",
        ),
      ),
    );
    if (init.signal?.aborted) {
      req.destroy(new Error("cancelled"));
      return;
    }
    init.signal?.addEventListener("abort", stop, { once: true });
    req.end(body);
  });
}
