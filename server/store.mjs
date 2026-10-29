import { DatabaseSync } from "node:sqlite";
import { mkdirSync, readFileSync } from "node:fs";
import { dirname } from "node:path";
import { ApiError } from "./validation.mjs";
export class Store {
  constructor(path = ":memory:") {
    if (path !== ":memory:") mkdirSync(dirname(path), { recursive: true });
    this.db = new DatabaseSync(path);
    this.db.exec(
      readFileSync(new URL("./migrations/001.sql", import.meta.url), "utf8"),
    );
  }
  get(kind, id) {
    const r = this.db
      .prepare("SELECT data FROM records WHERE kind=? AND id=?")
      .get(kind, id);
    return r ? JSON.parse(r.data) : null;
  }
  put(kind, id, data, space = null) {
    this.db
      .prepare(
        "INSERT INTO records(kind,id,space,data) VALUES(?,?,?,?) ON CONFLICT(kind,id) DO UPDATE SET data=excluded.data,space=excluded.space",
      )
      .run(kind, id, space, JSON.stringify(data));
  }
  list(kind, space) {
    return this.db
      .prepare(
        "SELECT data FROM records WHERE kind=? AND space=? ORDER BY id LIMIT 2000",
      )
      .all(kind, space)
      .map((r) => JSON.parse(r.data));
  }
  challenge(data) {
    this.db
      .prepare("DELETE FROM challenges WHERE expires<?")
      .run(Math.floor(Date.now() / 1000) - 3600);
    if (
      this.db.prepare("SELECT count(*) AS n FROM challenges").get().n >= 10000
    )
      throw new ApiError(
        429,
        "CHALLENGE_LIMIT",
        "Challenge capacity exceeded; retry later",
      );
    this.db
      .prepare("INSERT INTO challenges(nonce,expires,data) VALUES(?,?,?)")
      .run(data.message.nonce, data.message.expiresAt, JSON.stringify(data));
  }
  getChallenge(nonce) {
    const row = this.db
      .prepare("SELECT * FROM challenges WHERE nonce=?")
      .get(nonce);
    return row ? { ...JSON.parse(row.data), used: row.used } : null;
  }
  consume(nonce, fn) {
    this.db.exec("BEGIN IMMEDIATE");
    try {
      const r = this.db
        .prepare(
          "UPDATE challenges SET used=1 WHERE nonce=? AND used=0 AND expires>=?",
        )
        .run(nonce, Math.floor(Date.now() / 1000));
      if (r.changes !== 1)
        throw new ApiError(
          409,
          "REPLAY",
          "Authorization is expired or already used",
        );
      const value = fn();
      this.db.exec("COMMIT");
      return value;
    } catch (e) {
      this.db.exec("ROLLBACK");
      throw e;
    }
  }
  close() {
    this.db.close();
  }
}
