import { z } from "zod";

export const researchArguments = z
  .object({
    spaceId: z.string().regex(/^[a-z0-9][a-z0-9._-]{0,99}$/),
    periodDays: z.number().int().min(1).max(365).optional(),
  })
  .strict();

// Freeze the interval once per execution. Scan exhaustion still refers to the
// original bounded query; filtering cannot turn a partial scan into history.
export function researchWindow(snapshot, raw, now = Date.now()) {
  const args = researchArguments.parse(raw);
  const end = Math.floor(now / 1000),
    start = end - (args.periodDays ?? 30) * 86400;
  const queryRange = {
    start,
    end,
    startUtc: new Date(start * 1000).toISOString(),
    endUtc: new Date(end * 1000).toISOString(),
    interval: "[start,end)",
    periodDays: args.periodDays ?? 30,
  };
  let work;
  return {
    queryRange,
    snapshot: {
      directory(id) {
        if (id !== args.spaceId)
          throw Error("Research Space differs from approved input");
        return (work ||= snapshot.directory(id).then((d) => {
          const within = (v) =>
            Number.isFinite(v.created) && v.created >= start && v.created < end;
          const votes = (d.publicVotes || d.activity).filter(within);
          const people = new Map();
          for (const v of votes) {
            const key = v.voter.toLowerCase();
            const p = people.get(key) || {
              address: v.voter,
              chainId: 1,
              publicVotes: 0,
              lastVotedAt: 0,
            };
            p.publicVotes++;
            p.lastVotedAt = Math.max(p.lastVotedAt, v.created);
            people.set(key, p);
          }
          const proposals = d.proposals.filter(within);
          return {
            ...d,
            proposals,
            publicVotes: votes,
            activity: votes.slice(0, 50),
            participants: [...people.values()],
            provenance: {
              ...d.provenance,
              queryRange,
              proposalsMatchedInScan: proposals.length,
              publicVotesMatchedInScan: votes.length,
              proposalTimeField: "created",
              missingProposalTimesInScan: d.proposals.filter(
                (p) => !Number.isFinite(p.created),
              ).length,
            },
          };
        }));
      },
      proposal: (...args) => snapshot.proposal(...args),
      user: (...args) => snapshot.user(...args),
    },
  };
}
