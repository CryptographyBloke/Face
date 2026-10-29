import { Snapshot } from "../server/snapshot.mjs";
import { createApi } from "../server/app.mjs";
// Preview is deliberately read-only; no ephemeral database is used.
const api = createApi({
  snapshot: new Snapshot(),
  origin: process.env.APP_ORIGIN || "http://localhost:5173",
});
function handle(request) {
  const u = new URL(request.url);
  const route = u.searchParams.get("_route");
  const path = route ? "/" + route.replace(/^\//, "") : u.pathname;
  u.searchParams.delete("_route");
  return api(
    new Request("https://preview.invalid" + path + u.search, {
      method: request.method,
      headers: request.headers,
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
