import test from "node:test";
import assert from "node:assert/strict";
import { GET, POST } from "../api/index.mjs";
test("Vercel Web Request adapter rewrites health and keeps writes disabled", async () => {
  const health = await GET(
    new Request("https://preview.example/api?_route=health"),
  );
  assert.equal(health.status, 200);
  assert.equal((await health.json()).mode, "read-only");
  const post = await POST(
    new Request("https://preview.example/api?_route=v1/challenge", {
      method: "POST",
      headers: { Origin: "http://localhost:5173" },
    }),
  );
  assert.equal(post.status, 503);
});
