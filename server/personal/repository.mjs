import { PlatformRepository } from "../platform/repository.mjs";
import { ApiError } from "../validation.mjs";
export class PersonalAgentRepository extends PlatformRepository {
  async link(id, actor = null) {
    return (
      (
        await this.db.query(
          `SELECT l.*,a.name,a.metadata,a.controller AS profile_controller,a.revision AS profile_revision,a.published FROM face_platform.agent_links l JOIN face_platform.agents a ON a.id=l.agent_id WHERE l.id=$1::uuid AND ($2=l.owner OR $2=l.controller OR (a.published AND l.status IN('active','revoked','disconnected')))`,
          [id, actor],
        )
      )[0] || null
    );
  }
  async myAgents(actor) {
    return this.db.query(
      `SELECT l.*,a.name,a.metadata,a.controller AS profile_controller,a.revision AS profile_revision,a.published FROM face_platform.agent_links l JOIN face_platform.agents a ON a.id=l.agent_id WHERE l.owner=$1 OR l.controller=$1 ORDER BY l.updated_at DESC LIMIT 50`,
      [actor],
    );
  }
  async identity(agentId, actor = null) {
    const [links, wallets, registration] = await Promise.all([
      this.db.query(
        `SELECT l.* FROM face_platform.agent_links l JOIN face_platform.agents a ON a.id=l.agent_id WHERE l.agent_id=$1::uuid AND ($2=l.owner OR $2=l.controller OR (a.published AND l.status IN('active','revoked','disconnected'))) ORDER BY l.updated_at DESC LIMIT 50`,
        [agentId, actor],
      ),
      this.db.query(
        "SELECT * FROM face_platform.agent_wallet_proofs WHERE agent_id=$1::uuid",
        [agentId],
      ),
      this.db.query(
        "SELECT * FROM face_platform.agent_registration_evidence WHERE agent_id=$1::uuid",
        [agentId],
      ),
    ]);
    return { links, wallets, registration: registration[0] || null };
  }
  async applyIdentity(nonce, actor, action, hash, origin, data, proof) {
    try {
      return (
        await this.db.query(
          "SELECT face_platform.apply_identity_change($1,$2,$3,$4,$5,$6::jsonb,$7::jsonb) AS result",
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
          "IDENTITY_REVISION_OR_REPLAY",
          "Association changed, expired or already exists; reload before signing",
        );
      throw e;
    }
  }
}
