import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import https from "node:https";
import { randomBytes } from "node:crypto";
import { ApiError } from "../validation.mjs";
export function publicIp(ip) {
  const family = isIP(ip);
  if (family === 4) {
    const p = ip.split(".").map(Number);
    return !(
      p[0] === 0 ||
      p[0] === 10 ||
      p[0] === 127 ||
      (p[0] === 192 && p[1] === 0) ||
      (p[0] === 198 && p[1] === 51 && p[2] === 100) ||
      (p[0] === 203 && p[1] === 0 && p[2] === 113) ||
      p[0] >= 224 ||
      (p[0] === 169 && p[1] === 254) ||
      (p[0] === 172 && p[1] >= 16 && p[1] <= 31) ||
      (p[0] === 192 && p[1] === 168) ||
      (p[0] === 100 && p[1] >= 64 && p[1] <= 127) ||
      (p[0] === 198 && (p[1] === 18 || p[1] === 19))
    );
  }
  if (family === 6) {
    const v = ip.toLowerCase();
    const second = parseInt(v.split(":")[1] || "0", 16);
    if (v.startsWith("2001:") && second < 0x200) return false;
    if (v.startsWith("3fff:")) return false;
    return v.startsWith("2") || v.startsWith("3")
      ? !v.startsWith("2001:db8:") &&
          !v.startsWith("2001:0:") &&
          !v.startsWith("2002:") &&
          !v.includes(".") &&
          !v.startsWith("::") &&
          !/^(fc|fd|fe8|fe9|fea|feb|ff)/.test(v)
      : false;
  }
  return false;
}
export async function fetchPublicJson(
  input,
  { resolve = lookup, request = https.request, maxBytes = 32768 } = {},
) {
  const url = new URL(input);
  if (
    url.protocol !== "https:" ||
    url.username ||
    url.password ||
    (url.port && url.port !== "443") ||
    url.hash ||
    isIP(url.hostname) ||
    url.hostname === "localhost" ||
    url.hostname.endsWith(".localhost")
  )
    throw new ApiError(
      422,
      "ENDPOINT_URL",
      "Use a public HTTPS hostname without credentials",
    );
  const records = await resolve(url.hostname, { all: true, verbatim: true });
  if (!records.length || records.some((r) => !publicIp(r.address)))
    throw new ApiError(
      422,
      "ENDPOINT_NETWORK",
      "Endpoint resolves to a restricted network",
    );
  const selected = records[0];
  return new Promise((done, fail) => {
    const req = request(
      url,
      {
        method: "GET",
        headers: {
          Accept: "application/json",
          "User-Agent": "WalletFace-Endpoint-Verification/1",
        },
        servername: url.hostname,
        lookup: (_host, options, callback) =>
          options?.all
            ? callback(null, [selected])
            : callback(null, selected.address, selected.family),
      },
      (res) => {
        if (
          res.statusCode !== 200 ||
          !(res.headers["content-type"] || "").includes("application/json")
        ) {
          res.resume();
          fail(
            new ApiError(
              422,
              "ENDPOINT_RESPONSE",
              "Endpoint must return HTTP 200 application/json without redirects",
            ),
          );
          return;
        }
        let size = 0;
        const chunks = [];
        res.on("data", (chunk) => {
          size += chunk.length;
          if (size > maxBytes) {
            req.destroy();
            fail(
              new ApiError(413, "ENDPOINT_SIZE", "Endpoint proof is too large"),
            );
          } else chunks.push(chunk);
        });
        res.on("end", () => {
          try {
            done(JSON.parse(Buffer.concat(chunks).toString("utf8")));
          } catch {
            fail(
              new ApiError(
                422,
                "ENDPOINT_JSON",
                "Endpoint proof is invalid JSON",
              ),
            );
          }
        });
      },
    );
    req.setTimeout(5000, () => req.destroy(new Error("timeout")));
    req.on("error", () =>
      fail(
        new ApiError(
          502,
          "ENDPOINT_UNAVAILABLE",
          "Endpoint verification failed",
        ),
      ),
    );
    req.end();
  });
}
export function endpointProofRequest(origin, agentId, endpointUrl) {
  const u = new URL(endpointUrl);
  return {
    type: "walletface.endpoint-control/1",
    agentId,
    origin,
    endpointOrigin: u.origin,
    nonce: "0x" + randomBytes(32).toString("hex"),
    expiresAt: Math.floor(Date.now() / 1000) + 300,
  };
}
export async function checkEndpointProof(
  challenge,
  controller,
  fetcher = fetchPublicJson,
) {
  const url = challenge.endpointOrigin + "/.well-known/wallet-face-agent.json";
  const body = await fetcher(url);
  if (
    body.agentId !== challenge.agentId ||
    body.controller?.toLowerCase() !== controller.toLowerCase() ||
    body.nonce !== challenge.nonce ||
    body.origin !== challenge.origin ||
    challenge.expiresAt < Math.floor(Date.now() / 1000)
  )
    throw new ApiError(
      422,
      "ENDPOINT_PROOF",
      "Publish the exact current endpoint-control proof",
    );
  return {
    status: "verified",
    url: challenge.endpointOrigin,
    proofUrl: url,
    checkedAt: new Date().toISOString(),
    nonce: challenge.nonce,
  };
}
