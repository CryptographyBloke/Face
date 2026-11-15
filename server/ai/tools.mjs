import { z } from "zod";
import { tool } from "ai";
import { address, spaceId, ApiError } from "../validation.mjs";
import { resolveProfile } from "../resolver.mjs";

const sid = z.string().regex(/^[a-z0-9][a-z0-9._-]{0,99}$/);
const addr = z.string().regex(/^0x[0-9a-fA-F]{40}$/);
const spaceInput = { spaceId: sid };
const range = z
  .object({
    start: z.number().int().nonnegative(),
    end: z.number().int().positive(),
  })
  .strict()
  .refine((r) => r.start < r.end);
export const toolSchemas = {
  getWalletProfile: z.object({ chainId: z.literal(1), address: addr }).strict(),
  getSpace: z.object(spaceInput).strict(),
  listParticipants: z
    .object({
      ...spaceInput,
      search: z.string().max(100).default(""),
      sort: z.enum(["votes", "recent", "address"]).default("votes"),
      page: z.number().int().min(0).max(24).default(0),
      limit: z.number().int().min(1).max(20).default(10),
    })
    .strict(),
  getGovernanceActivity: z
    .object({
      ...spaceInput,
      limit: z.number().int().min(1).max(20).default(10),
      address: addr.optional(),
      start: z.number().int().nonnegative().optional(),
      end: z.number().int().positive().optional(),
    })
    .strict()
    .refine((v) => v.start == null || v.end == null || v.start < v.end),
  getProposal: z
    .object({
      ...spaceInput,
      proposalId: z.string().regex(/^0x[0-9a-fA-F]{64}$/),
    })
    .strict(),
  analyzeParticipation: z
    .object({ ...spaceInput, ranges: z.array(range).max(2).default([]) })
    .strict(),
};
const descriptions = {
  getWalletProfile:
    "Resolve a public Ethereum wallet profile, avatar and checked claim status. A profile is not proof of real-world identity.",
  getSpace:
    "Read a Snapshot Space and recent proposal metadata from the bounded scan.",
  listParticipants:
    "Rank/search observed public voters within the bounded scan. Voting is not organization membership.",
  getGovernanceActivity:
    "Read a bounded list of public votes, optionally filtered by wallet and [start,end) Unix seconds.",
  getProposal:
    "Read one Snapshot proposal in the specified Space, including bounded body, choices, timing and public scores.",
  analyzeParticipation:
    "Compute participation totals, ranking, distribution, UTC daily counts and up to two explicit [start,end) ranges from scanned public votes.",
};
export function analyzeDataset(d, ranges = []) {
  const votes = d.publicVotes || d.activity;
  const rank = [...d.participants].sort(
    (a, b) =>
      b.publicVotes - a.publicVotes || a.address.localeCompare(b.address),
  );
  const buckets = { one: 0, twoToFive: 0, sixPlus: 0 };
  for (const p of rank)
    buckets[
      p.publicVotes === 1 ? "one" : p.publicVotes <= 5 ? "twoToFive" : "sixPlus"
    ]++;
  const daily = {};
  for (const v of votes) {
    const date = new Date(v.created * 1000).toISOString().slice(0, 10);
    daily[date] = (daily[date] || 0) + 1;
  }
  return {
    publicVotes: votes.length,
    uniqueWallets: rank.length,
    ranking: rank.slice(0, 10),
    rankingScope: "observed_scan",
    distribution: buckets,
    topFiveShare: votes.length
      ? rank.slice(0, 5).reduce((n, p) => n + p.publicVotes, 0) / votes.length
      : null,
    dailyCounts: Object.entries(daily)
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(-60)
      .map(([date, count]) => ({ date, count })),
    ranges: ranges.map((r) => {
      const selected = votes.filter(
        (v) => v.created >= r.start && v.created < r.end,
      );
      return {
        ...r,
        publicVotes: selected.length,
        uniqueWallets: new Set(selected.map((v) => v.voter.toLowerCase())).size,
      };
    }),
    trendScope:
      "UTC days with observed votes only; absent days and older records are not established by this scan",
  };
}
/** @typedef {'getWalletProfile'|'getSpace'|'listParticipants'|'getGovernanceActivity'|'getProposal'|'analyzeParticipation'} ToolName */
export function createToolRegistry({
  snapshot,
  store = null,
  ens = null,
  signal,
  maxCalls = 6,
  onResult = () => {},
  onProgress = () => {},
}) {
  let calls = 0;
  async function run(name, input) {
    signal?.throwIfAborted();
    if (!Object.hasOwn(toolSchemas, name))
      throw new ApiError(403, "READ_ONLY_TOOL", "Unsupported read-only tool");
    const b = toolSchemas[name].parse(input);
    if (++calls > maxCalls)
      throw new ApiError(429, "TOOL_LIMIT", "Tool execution limit reached");
    onProgress(name);
    let data, provenance;
    if (name === "getWalletProfile") {
      data = await resolveProfile(
        { snapshot, store, ens },
        1,
        address(b.address),
      );
      provenance = {
        source: "walletface",
        sourceUrl: `https://walletface.org/u/${data.address}`,
        fetchedAt: data.cache.fetchedAt,
        scope: "public_profile",
        claimVerified: data.provenance.profileClaimVerified,
      };
    } else if (name === "getProposal") {
      data = await snapshot.proposal(spaceId(b.spaceId), b.proposalId, signal);
      provenance = data.provenance;
    } else {
      const work = snapshot.directory(spaceId(b.spaceId));
      const d = signal
        ? await new Promise((resolve, reject) => {
            const stop = () => reject(signal.reason);
            signal.addEventListener("abort", stop, { once: true });
            work
              .then(resolve, reject)
              .finally(() => signal.removeEventListener("abort", stop));
          })
        : await work;
      provenance = {
        ...d.provenance,
        scope: "bounded_public_governance_scan",
        completeness:
          d.provenance.votesComplete && d.provenance.proposalsComplete
            ? "query_exhausted"
            : "scan_limited",
      };
      if (name === "getSpace")
        data = {
          space: { ...d.space, about: d.space.about?.slice(0, 1500) },
          proposals: d.proposals.slice(0, 12),
          proposalListTruncated: d.proposals.length > 12,
        };
      if (name === "listParticipants") {
        const q = b.search.toLowerCase();
        const items = d.participants
          .filter((p) => p.address.toLowerCase().includes(q))
          .map((p) => ({
            ...p,
            name: store?.get("profile", p.address.toLowerCase())?.name || null,
          }));
        items.sort((a, c) =>
          b.sort === "votes"
            ? c.publicVotes - a.publicVotes ||
              a.address.localeCompare(c.address)
            : b.sort === "recent"
              ? c.lastVotedAt - a.lastVotedAt ||
                a.address.localeCompare(c.address)
              : a.address.localeCompare(c.address),
        );
        data = {
          kind: "public_governance_participants",
          items: items.slice(b.page * b.limit, (b.page + 1) * b.limit),
          page: b.page,
          totalObserved: items.length,
          hasMore: (b.page + 1) * b.limit < items.length,
        };
      }
      if (name === "getGovernanceActivity") {
        const items = (d.publicVotes || d.activity).filter(
          (v) =>
            (!b.address || v.voter.toLowerCase() === b.address.toLowerCase()) &&
            (b.start == null || v.created >= b.start) &&
            (b.end == null || v.created < b.end),
        );
        data = {
          items: items.slice(0, b.limit),
          matchedInScan: items.length,
          returnedLimit: b.limit,
          proposals: d.proposals.slice(0, 8),
        };
      }
      if (name === "analyzeParticipation") data = analyzeDataset(d, b.ranges);
    }
    signal?.throwIfAborted();
    const result = { tool: name, data, provenance, untrustedContent: true };
    if (Buffer.byteLength(JSON.stringify(result)) > 20000)
      throw new ApiError(
        502,
        "TOOL_RESULT_SIZE",
        "Tool result exceeds context budget",
      );
    onResult(result);
    return result;
  }
  const tools = Object.fromEntries(
    Object.entries(toolSchemas).map(([name, inputSchema]) => [
      name,
      tool({
        description: descriptions[name],
        inputSchema,
        execute: (input) => run(name, input),
      }),
    ]),
  );
  return {
    tools,
    run,
    get calls() {
      return calls;
    },
  };
}
