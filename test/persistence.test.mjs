import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Store } from "../server/store.mjs";
test("SQLite survives restart, enforces constraints and atomically consumes a nonce", () => {
  const dir = mkdtempSync(join(tmpdir(), "face-test-"));
  const path = join(dir, "db.sqlite");
  try {
    let s = new Store(path);
    s.put("profile", "alice", { name: "Alice" });
    s.close();
    s = new Store(path);
    assert.equal(s.get("profile", "alice").name, "Alice");
    assert.throws(() => s.put("untrusted-kind", "id", {}));
    const c = {
      message: {
        nonce: "nonce",
        expiresAt: Math.floor(Date.now() / 1000) + 300,
      },
    };
    s.challenge(c);
    assert.throws(() =>
      s.consume("nonce", () => {
        throw Error("transaction failure");
      }),
    );
    assert.equal(s.getChallenge("nonce").used, 0);
    s.consume("nonce", () => s.put("profile", "bob", { name: "Bob" }));
    assert.throws(() => s.consume("nonce", () => {}), /used/);
    assert.equal(s.get("profile", "bob").name, "Bob");
    s.close();
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
