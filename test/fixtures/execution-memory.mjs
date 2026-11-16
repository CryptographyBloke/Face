import { tokenHash } from "../../server/execution/runs.mjs";
import { digest } from "../../server/platform/authorization.mjs";
export class MemoryRuns {
  rows = new Map();
  log = [];
  reservations = 0;
  async reserve() {
    this.reservations++;
  }
  async read(id, actor, secret) {
    const r = this.rows.get(id);
    return r &&
      ((r.owner && r.owner === actor) ||
        (!r.owner && r.access_hash === tokenHash(secret)))
      ? structuredClone(r)
      : null;
  }
  async create(input, service, owner, accessHash, planHash) {
    if (this.rows.has(input.id)) throw Error("duplicate");
    const r = {
      id: input.id,
      service_id: service.id,
      service_version: String(service.revision),
      owner,
      access_hash: accessHash,
      request_hash: digest(input),
      plan_hash: planHash,
      plan: structuredClone(service),
      input: structuredClone(input),
      state: "awaiting_approval",
      result: null,
    };
    this.rows.set(r.id, r);
    return structuredClone(r);
  }
  async event(id, kind, data) {
    this.log.push({ id, kind, data });
  }
  async events(id) {
    return this.log.filter((e) => e.id === id);
  }
  async expireLease() {}
  async claim(id, executionId) {
    const r = this.rows.get(id);
    if (r.state !== "awaiting_approval" || r.cancel_requested) return null;
    r.state = "executing";
    r.execution_id = executionId;
    return structuredClone(r);
  }
  async update(id, executionId, state, result, error, remoteTaskId) {
    const r = this.rows.get(id);
    if (
      r.execution_id !== executionId ||
      !["executing", "waiting_remote", "needs_input"].includes(r.state)
    )
      return null;
    r.state = r.cancel_requested ? "cancelled" : state;
    r.result = r.cancel_requested ? null : result;
    r.error_code = error;
    r.remote_task_id = remoteTaskId;
    return structuredClone(r);
  }
  async cancel(id) {
    const r = this.rows.get(id);
    r.cancel_requested = true;
    if (r.state !== "executing") r.state = "cancelled";
    return structuredClone(r);
  }
}
