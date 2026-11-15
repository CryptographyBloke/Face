import { Snapshot } from "../server/snapshot.mjs";
import { createApi } from "../server/app.mjs";
// Preview is deliberately read-only; no ephemeral database is used.
const snapshot = new Snapshot();
const api = createApi({
  snapshot,
  origin: process.env.APP_ORIGIN || "https://walletface.org",
});
const handlers = new Map();
function handle(request) {
  const u = new URL(request.url);
  const route = u.searchParams.get("_route");
  const path = route ? "/" + route.replace(/^\//, "") : u.pathname;
  u.searchParams.delete("_route");
  if (path.startsWith("/v1/ai/") && !handlers.has(u.origin)) {
    if (handlers.size >= 20) handlers.delete(handlers.keys().next().value);
    handlers.set(u.origin, createApi({ snapshot, origin: u.origin }));
  }
  const handler = path.startsWith("/v1/ai/") ? handlers.get(u.origin) : api;
  return handler(
    new Request(u.origin + path + u.search, {
      method: request.method,
      headers: request.headers,
      signal: request.signal,
      ...(request.body ? { body: request.body, duplex: "half" } : {}),
    }),
    request.headers.get("x-real-ip") || "preview",
  );
}
export function GET(request) {
  return handle(request);
}
export function POST(request) {
  return handle(request);
}
export function OPTIONS(request) {
  return handle(request);
}
