import { z } from "zod";
import { address, spaceId, ApiError } from "./validation.mjs";

const spaceSchema = z.object({
  id: z.string(),
  name: z.string().nullable(),
  about: z.string().nullable(),
  network: z.string(),
  avatar: z.string().nullable(),
  admins: z.array(z.string()),
});
const proposalSchema = z.object({
  id: z.string(),
  title: z.string(),
  created: z.number(),
  privacy: z.string().nullable(),
  votes: z.number(),
});
const voteSchema = z.object({
  id: z.string(),
  voter: z.string(),
  created: z.number(),
  vp: z.number().finite(),
  proposal: z.object({
    id: z.string(),
    title: z.string(),
    privacy: z.string().nullable(),
  }),
});
function parse(schema, value) {
  try {
    return schema.parse(value);
  } catch {
    throw new ApiError(
      502,
      "SNAPSHOT_SCHEMA",
      "Snapshot returned an unexpected response shape",
    );
  }
}
export class Snapshot {
  constructor({
    fetchImpl = fetch,
    endpoint = "https://hub.snapshot.org/graphql",
    pageSize = 100,
    maxVotes = 500,
    maxProposals = 50,
    spacingMs = 1100,
    now = () => Date.now(),
    sleep = (ms) => new Promise((r) => setTimeout(r, ms)),
  } = {}) {
    Object.assign(this, {
      fetchImpl,
      endpoint,
      pageSize,
      maxVotes,
      maxProposals,
      spacingMs,
      now,
      sleep,
    });
    this.cache = new Map();
    this.pending = new Map();
    this.queue = Promise.resolve();
    this.lastRequest = 0;
    this.queued = 0;
  }
  async query(query, variables) {
    if (this.queued >= 64)
      throw new ApiError(
        503,
        "SNAPSHOT_BUSY",
        "Snapshot request queue is full; retry later",
      );
    this.queued++;
    const work = async () => {
      for (let attempt = 0; attempt < 3; attempt++) {
        await this.sleep(
          Math.max(0, this.spacingMs - (this.now() - this.lastRequest)),
        );
        this.lastRequest = this.now();
        try {
          const res = await this.fetchImpl(this.endpoint, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ query, variables }),
            signal: AbortSignal.timeout(8000),
          });
          if (res.status === 429 || res.status >= 500) {
            if (attempt < 2) {
              await this.sleep(300 * 2 ** attempt);
              continue;
            }
          }
          if (!res.ok)
            throw new ApiError(
              502,
              "SNAPSHOT_HTTP",
              `Snapshot returned HTTP ${res.status}`,
            );
          const body = await res.json();
          if (body.errors?.length || !body.data)
            throw new ApiError(502, "SNAPSHOT_QUERY", "Snapshot query failed");
          return body.data;
        } catch (err) {
          if (err instanceof ApiError || attempt === 2)
            throw err instanceof ApiError
              ? err
              : new ApiError(
                  502,
                  "SNAPSHOT_UNAVAILABLE",
                  "Snapshot timed out or is unavailable",
                );
          await this.sleep(300 * 2 ** attempt);
        }
      }
    };
    const result = this.queue.then(work, work).finally(() => {
      this.queued--;
    });
    this.queue = result.catch(() => {});
    return result;
  }
  async cached(key, fn, ttl = 60000) {
    const c = this.cache.get(key);
    if (c && c.expires > this.now()) return c.value;
    if (this.pending.has(key)) return this.pending.get(key);
    const p = fn()
      .then((value) => {
        if (this.cache.size > 200)
          this.cache.delete(this.cache.keys().next().value);
        this.cache.set(key, { value, expires: this.now() + ttl });
        return value;
      })
      .finally(() => this.pending.delete(key));
    this.pending.set(key, p);
    return p;
  }
  async user(addr) {
    return this.cached("user:" + addr.toLowerCase(), async () => {
      const data = await this.query(
        "query($id:String!){ user(id:$id){ avatar name about } }",
        { id: addr.toLowerCase() },
      );
      return parse(
        z
          .object({
            avatar: z.string().nullable(),
            name: z.string().nullable(),
            about: z.string().nullable(),
          })
          .nullable(),
        data.user,
      );
    });
  }
  async space(id, fresh = false) {
    spaceId(id);
    const load = async () => {
      const data = await this.query(
        "query($id:String!){space(id:$id){id name about network avatar admins}}",
        { id },
      );
      if (!data.space)
        throw new ApiError(404, "SPACE_NOT_FOUND", "Snapshot Space not found");
      return parse(spaceSchema, data.space);
    };
    return fresh ? load() : this.cached("space:" + id, load);
  }
  async directory(id) {
    spaceId(id);
    return this.cached(
      "directory:" + id,
      async () => {
        const space = await this.space(id);
        const cutoff = Math.floor(this.now() / 1000);
        const proposals = [];
        const votes = [];
        let proposalsComplete = false;
        let votesComplete = false;
        for (let skip = 0; skip < this.maxProposals; skip += this.pageSize) {
          const first = Math.min(this.pageSize, this.maxProposals - skip);
          const d = await this.query(
            'query($id:String!,$first:Int!,$skip:Int!,$cutoff:Int!){proposals(first:$first,skip:$skip,where:{space:$id,created_lte:$cutoff},orderBy:"created",orderDirection:desc){id title created privacy votes}}',
            { id, first, skip, cutoff },
          );
          const page = parse(z.array(proposalSchema), d.proposals);
          proposals.push(...page);
          if (page.length < first) {
            proposalsComplete = true;
            break;
          }
        }
        for (let skip = 0; skip < this.maxVotes; skip += this.pageSize) {
          const first = Math.min(this.pageSize, this.maxVotes - skip);
          const d = await this.query(
            'query($id:String!,$first:Int!,$skip:Int!,$cutoff:Int!){votes(first:$first,skip:$skip,where:{space:$id,created_lte:$cutoff},orderBy:"created",orderDirection:desc){id voter created vp proposal{id title privacy}}}',
            { id, first, skip, cutoff },
          );
          const page = parse(z.array(voteSchema), d.votes);
          votes.push(...page);
          if (page.length < first) {
            votesComplete = true;
            break;
          }
        }
        const uniqueVotes = [
          ...new Map(
            votes.filter((v) => !v.proposal.privacy).map((v) => [v.id, v]),
          ).values(),
        ];
        const people = new Map();
        for (const v of uniqueVotes) {
          let a;
          try {
            a = address(v.voter);
          } catch {
            continue;
          }
          const key = a.toLowerCase();
          const p = people.get(key) || {
            address: a,
            chainId: 1,
            publicVotes: 0,
            lastVotedAt: 0,
          };
          p.publicVotes++;
          p.lastVotedAt = Math.max(p.lastVotedAt, v.created);
          people.set(key, p);
        }
        return {
          space,
          proposals: [...new Map(proposals.map((p) => [p.id, p])).values()],
          activity: uniqueVotes.slice(0, 50),
          participants: [...people.values()],
          provenance: {
            source: "snapshot",
            sourceUrl: `https://snapshot.box/#/${encodeURIComponent(id)}`,
            fetchedAt: new Date(this.now()).toISOString(),
            cutoff,
            votesScanned: votes.length,
            proposalsScanned: proposals.length,
            votesComplete,
            proposalsComplete,
            scanLimits: { votes: this.maxVotes, proposals: this.maxProposals },
            privacyPolicy:
              "Public governance participation from the bounded Snapshot scan. Shielded/private proposal votes are omitted.",
          },
        };
      },
      120000,
    );
  }
}
