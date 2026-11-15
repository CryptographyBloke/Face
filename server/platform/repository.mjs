import { platformDb } from "./db.mjs";
import { ApiError } from "../validation.mjs";
export class PlatformRepository {
  constructor(env = process.env, db = platformDb(env)) {
    this.db = db;
  }
  async createChallenge(typed, payload) {
    const m = typed.message;
    await this.db.query(
      "INSERT INTO face_platform.challenges(nonce,actor,action,payload,payload_hash,origin,expires_at) VALUES($1,$2,$3,$4::jsonb,$5,$6,to_timestamp($7))",
      [
        m.nonce,
        m.actor.toLowerCase(),
        m.action,
        JSON.stringify({ typedData: typed, payload }),
        m.payloadHash,
        m.origin,
        m.expiresAt,
      ],
    );
  }
  async challenge(nonce) {
    return (
      (
        await this.db.query(
          "SELECT payload,used_at,expires_at FROM face_platform.challenges WHERE nonce=$1",
          [nonce],
        )
      )[0] || null
    );
  }
  async apply(nonce, actor, action, hash, origin, data, proof) {
    try {
      return (
        await this.db.query(
          "SELECT face_platform.apply_authorized_change($1,$2,$3,$4,$5,$6::jsonb,$7::jsonb) AS result",
          [
            nonce,
            actor,
            action,
            hash,
            origin,
            JSON.stringify(data),
            JSON.stringify(proof),
          ],
        )
      )[0].result;
    } catch (e) {
      if (/FACE_|duplicate key/.test(e.message || ""))
        throw new ApiError(
          409,
          "REVISION_OR_REPLAY",
          "Record changed, authorization expired or operation was already applied",
        );
      throw e;
    }
  }
  async agent(id, includePrivate = false, actor = null) {
    const a = (
      await this.db.query(
        "SELECT * FROM face_platform.agents WHERE id=$1::uuid AND (published OR ($2::boolean AND controller=$3))",
        [id, includePrivate, actor],
      )
    )[0];
    return a || null;
  }
  async agents(search = "", limit = 20) {
    return this.db.query(
      "SELECT id,controller,name,metadata,revision,created_at,updated_at,proof FROM face_platform.agents WHERE published AND (name ILIKE $1 OR controller ILIKE $1) ORDER BY updated_at DESC LIMIT $2",
      ["%" + search + "%", limit],
    );
  }
  async report(id, actor = null) {
    return (
      (
        await this.db.query(
          "SELECT * FROM face_platform.reports WHERE id=$1::uuid AND (public OR owner=$2)",
          [id, actor],
        )
      )[0] || null
    );
  }
  async workspace(actor) {
    const [agents, reports, actions, organizations] = await Promise.all([
      this.db.query(
        "SELECT * FROM face_platform.agents WHERE controller=$1 ORDER BY updated_at DESC LIMIT 50",
        [actor],
      ),
      this.db.query(
        "SELECT * FROM face_platform.reports WHERE owner=$1 ORDER BY created_at DESC LIMIT 50",
        [actor],
      ),
      this.db.query(
        "SELECT * FROM face_platform.actions WHERE owner=$1 ORDER BY created_at DESC LIMIT 50",
        [actor],
      ),
      this.db.query(
        "SELECT * FROM face_platform.organizations WHERE admin=$1 ORDER BY updated_at DESC LIMIT 50",
        [actor],
      ),
    ]);
    return { agents, reports, actions, organizations };
  }
  async action(id, actor) {
    return (
      (
        await this.db.query(
          "SELECT * FROM face_platform.actions WHERE id=$1::uuid AND owner=$2",
          [id, actor],
        )
      )[0] || null
    );
  }
  async organization(id) {
    return (
      (
        await this.db.query(
          "SELECT * FROM face_platform.organizations WHERE space_id=$1",
          [id],
        )
      )[0] || null
    );
  }
  async records(space) {
    return this.db.query(
      "SELECT * FROM face_platform.organization_records WHERE space_id=$1 AND kind<>'proposal.draft.save' ORDER BY issued_at DESC LIMIT 100",
      [space],
    );
  }
  async audit(target, actor) {
    return this.db.query(
      "SELECT id,actor,action,target,payload_hash,outcome,created_at FROM face_platform.audit_events WHERE target=$1 AND actor=$2 ORDER BY id DESC LIMIT 100",
      [target, actor],
    );
  }
}
