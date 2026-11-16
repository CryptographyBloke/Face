import { Snapshot } from "../server/snapshot.mjs";
import { createApi } from "../server/app.mjs";
// Legacy native writes remain disabled. Agent writes use separate durable authorization.
const snapshot = new Snapshot();
const api = createApi({
  snapshot,
  origin: process.env.APP_ORIGIN || "https://walletface.org",
});
const handlers = new Map();
export function normalizeAppUrl(input) {
  const u = new URL(input);
  const route = u.searchParams.get("_route");
  if (route && u.searchParams.get("path") === route.replace(/^v1\//, ""))
    u.searchParams.delete("path");
  if (route) u.pathname = "/" + route.replace(/^\//, "");
  u.searchParams.delete("_route");
  return u;
}
function handle(request) {
  const u = normalizeAppUrl(request.url);
  const route = u.searchParams.get("_route");
  const path = route ? "/" + route.replace(/^\//, "") : u.pathname;
  u.searchParams.delete("_route");
  if (
    (path.startsWith("/v1/ai/") ||
      path.startsWith("/v1/platform/") ||
      path.startsWith("/v1/payments/") ||
      path.startsWith("/v1/spending/") ||
      path === "/v1/mcp") &&
    !handlers.has(u.origin)
  ) {
    if (handlers.size >= 20) handlers.delete(handlers.keys().next().value);
    handlers.set(u.origin, createApi({ snapshot, origin: u.origin }));
  }
  const handler =
    path.startsWith("/v1/ai/") ||
    path.startsWith("/v1/platform/") ||
    path.startsWith("/v1/payments/") ||
      path.startsWith("/v1/spending/") ||
    path === "/v1/mcp"
      ? handlers.get(u.origin)
      : api;
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
