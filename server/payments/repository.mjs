import { platformDb } from "../platform/db.mjs";
import { ApiError } from "../validation.mjs";
export class PaymentRepository {
  constructor(env = process.env, db = platformDb(env)) {
    this.db = db;
  }
  async quote(id) {
    return (
      (
        await this.db.query(
          "SELECT * FROM face_platform.payment_quotes WHERE id=$1::uuid",
          [id],
        )
      )[0] || null
    );
  }
  async createQuote(id, space, url, requirements) {
    await this.db.query(
      "INSERT INTO face_platform.payment_quotes(id,space_id,resource_url,requirements,expires_at) VALUES($1::uuid,$2,$3,$4::jsonb,now()+interval '10 minutes') ON CONFLICT DO NOTHING",
      [id, space, url, JSON.stringify(requirements)],
    );
    return this.quote(id);
  }
  async receipt(id) {
    return (
      (
        await this.db.query(
          "SELECT * FROM face_platform.payment_receipts WHERE id=$1::uuid",
          [id],
        )
      )[0] || null
    );
  }
  async claim(id, p, r) {
    try {
      const rows = await this.db.query(
        "INSERT INTO face_platform.payment_receipts(id,network,asset,amount,receiver,payer,authorization_nonce,payload_hash,authorization_data) VALUES($1::uuid,$2,$3,$4::numeric,$5,$6,$7,$8,$9::jsonb) ON CONFLICT DO NOTHING RETURNING id",
        [
          id,
          r.network,
          r.asset.toLowerCase(),
          r.amount,
          r.payTo.toLowerCase(),
          p.payer,
          p.nonce,
          p.payloadHash,
          JSON.stringify(p.authorization),
        ],
      );
      const record = await this.receipt(id);
      if (!record || record.payload_hash !== p.payloadHash)
        throw new ApiError(
          409,
          "PAYMENT_REPLAY",
          "Authorization or request ID is already bound to another payment",
        );
      return { record, claimed: rows.length === 1 };
    } catch (e) {
      if (/duplicate key/.test(e.message))
        throw new ApiError(
          409,
          "PAYMENT_REPLAY",
          "Authorization was already submitted",
        );
      throw e;
    }
  }
  async transition(id, expected, next, patch = {}) {
    return (
      await this.db.query(
        "SELECT face_platform.transition_payment($1::uuid,$2,$3,$4::jsonb) AS result",
        [id, expected, next, JSON.stringify(patch)],
      )
    )[0].result;
  }
  async list(payer) {
    return this.db.query(
      "SELECT id,network,asset,amount,receiver,payer,state,transaction_hash,error_code,created_at,updated_at FROM face_platform.payment_receipts WHERE payer=$1 ORDER BY created_at DESC LIMIT 50",
      [payer],
    );
  }
}
