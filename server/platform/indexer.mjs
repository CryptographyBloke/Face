import { randomUUID } from "node:crypto";
import { z } from "zod";
import { ApiError, spaceId } from "../validation.mjs";
const proposal = z.object({
  id: z.string().max(100),
  title: z.string().max(1000),
  created: z.number().int().nonnegative(),
  privacy: z.string().max(100).nullable(),
});
const vote = z.object({
  id: z.string().max(100),
  voter: z.string().regex(/^0x[0-9a-fA-F]{40}$/),
  created: z.number().int().nonnegative(),
  vp: z.number().finite().nonnegative(),
  proposal: z.object({
    id: z.string().max(100),
    privacy: z.string().max(100).nullable(),
  }),
});
export class GovernanceIndex {
  constructor({ snapshot, db }) {
    this.snapshot = snapshot;
    this.db = db;
  }
  async refresh(id) {
    spaceId(id);
    await this.snapshot.space(id);
    const token = randomUUID();
    const rows = await this.db.query(
      `INSERT INTO face_platform.scan_jobs(space_id,cutoff,lease_until,lease_token) VALUES($1,$2,now()+interval '45 seconds',$3)
   ON CONFLICT(space_id) DO UPDATE SET lease_until=now()+interval '45 seconds',lease_token=$3,
   cutoff=CASE WHEN face_platform.scan_jobs.status='exhausted' THEN $2 ELSE face_platform.scan_jobs.cutoff END,
   proposal_offset=CASE WHEN face_platform.scan_jobs.status='exhausted' THEN 0 ELSE face_platform.scan_jobs.proposal_offset END,
   vote_offset=CASE WHEN face_platform.scan_jobs.status='exhausted' THEN 0 ELSE face_platform.scan_jobs.vote_offset END,
   proposals_complete=CASE WHEN face_platform.scan_jobs.status='exhausted' THEN false ELSE face_platform.scan_jobs.proposals_complete END,
   votes_complete=CASE WHEN face_platform.scan_jobs.status='exhausted' THEN false ELSE face_platform.scan_jobs.votes_complete END,
   proposals_scanned=CASE WHEN face_platform.scan_jobs.status='exhausted' THEN 0 ELSE face_platform.scan_jobs.proposals_scanned END,
   votes_scanned=CASE WHEN face_platform.scan_jobs.status='exhausted' THEN 0 ELSE face_platform.scan_jobs.votes_scanned END
   WHERE face_platform.scan_jobs.lease_until IS NULL OR face_platform.scan_jobs.lease_until<now() RETURNING *`,
      [id, Math.floor(Date.now() / 1000), token],
    );
    if (!rows[0])
      throw new ApiError(409, "INDEX_BUSY", "A refresh is already running");
    const j = rows[0],
      first = 100;
    try {
      const variables = { id, first, cutoff: Number(j.cutoff) };
      const [p, v] = await Promise.all([
        j.proposals_complete
          ? { proposals: [] }
          : this.snapshot.query(
              'query($id:String!,$first:Int!,$skip:Int!,$cutoff:Int!){proposals(first:$first,skip:$skip,where:{space:$id,created_lte:$cutoff},orderBy:"created",orderDirection:desc){id title created privacy}}',
              { ...variables, skip: j.proposal_offset },
            ),
        j.votes_complete
          ? { votes: [] }
          : this.snapshot.query(
              'query($id:String!,$first:Int!,$skip:Int!,$cutoff:Int!){votes(first:$first,skip:$skip,where:{space:$id,created_lte:$cutoff},orderBy:"created",orderDirection:desc){id voter created vp proposal{id privacy}}}',
              { ...variables, skip: j.vote_offset },
            ),
      ]);
      const proposals = z.array(proposal).max(first).parse(p.proposals),
        votes = z.array(vote).max(first).parse(v.votes);
      const publicVotes = votes
        .filter((v) => !v.proposal.privacy)
        .map((v) => ({
          id: v.id,
          voter: v.voter,
          proposal_id: v.proposal.id,
          created: v.created,
          voting_power: v.vp,
        }));
      await this.db.query(
        "SELECT face_platform.ingest_page($1,$2,$3::jsonb,$4::jsonb,$5,$6,$7,$8)",
        [
          id,
          token,
          JSON.stringify(proposals),
          JSON.stringify(publicVotes),
          proposals.length,
          votes.length,
          j.proposals_complete || proposals.length < first,
          j.votes_complete || votes.length < first,
        ],
      );
      return {
        proposalsFetched: proposals.length,
        votesFetched: votes.length,
        publicVotesStored: publicVotes.length,
        privateVotesOmitted: votes.length - publicVotes.length,
        ...(await this.analyze(id)),
      };
    } catch (e) {
      await this.db.query(
        "UPDATE face_platform.scan_jobs SET lease_until=NULL,lease_token=NULL,last_error='Upstream or validation failure',updated_at=now() WHERE space_id=$1 AND lease_token=$2",
        [id, token],
      );
      throw e;
    }
  }
  async analyze(
    id,
    {
      start = 0,
      end = Math.floor(Date.now() / 1000),
      compareStart,
      compareEnd,
    } = {},
  ) {
    spaceId(id);
    if (
      ![start, end].every(Number.isSafeInteger) ||
      start < 0 ||
      end <= start ||
      end - start > 200 * 366 * 86400
    )
      throw new ApiError(
        422,
        "RANGE",
        "Use a valid inclusive-start, exclusive-end time range",
      );
    const jobs = await this.db.query(
      "SELECT cutoff,proposals_scanned,votes_scanned,proposals_complete,votes_complete,status,updated_at FROM face_platform.scan_jobs WHERE space_id=$1",
      [id],
    );
    const base = `FROM face_platform.votes v LEFT JOIN face_platform.proposals p ON p.space_id=v.space_id AND p.id=v.proposal_id WHERE v.space_id=$1 AND NOT v.excluded AND coalesce(p.privacy,'')='' AND v.created>=$2 AND v.created<$3`;
    const [counts, ranking, distribution, trends] = await Promise.all([
      this.db.query(
        "SELECT count(*)::integer AS votes,count(DISTINCT voter)::integer AS wallets " +
          base,
        [id, start, end],
      ),
      this.db.query(
        'SELECT voter AS address,count(*)::integer AS votes,max(v.created)::float8 AS "lastVotedAt" ' +
          base +
          " GROUP BY voter ORDER BY votes DESC,voter LIMIT 20",
        [id, start, end],
      ),
      this.db.query(
        "SELECT n::integer AS votes,count(*)::integer AS wallets FROM (SELECT voter,count(*) n " +
          base +
          " GROUP BY voter)x GROUP BY n ORDER BY n",
        [id, start, end],
      ),
      this.db.query(
        "SELECT to_char(to_timestamp(v.created) AT TIME ZONE 'UTC','YYYY-MM') AS month,count(*)::integer AS votes,count(DISTINCT voter)::integer AS wallets " +
          base +
          " GROUP BY month ORDER BY month",
        [id, start, end],
      ),
    ]);
    let comparison = null;
    if (compareStart !== undefined || compareEnd !== undefined) {
      if (
        ![compareStart, compareEnd].every(Number.isSafeInteger) ||
        compareStart < 0 ||
        compareEnd <= compareStart
      )
        throw new ApiError(422, "RANGE", "Invalid comparison time range");
      const c = (
        await this.db.query(
          "SELECT count(*)::integer AS votes,count(DISTINCT voter)::integer AS wallets " +
            base,
          [id, compareStart, compareEnd],
        )
      )[0];
      comparison = {
        range: { start: compareStart, end: compareEnd },
        ...c,
        voteDelta: counts[0].votes - c.votes,
        walletDelta: counts[0].wallets - c.wallets,
      };
    }
    return {
      spaceId: id,
      range: { start, end },
      ...counts[0],
      ranking,
      distribution,
      trends,
      comparison,
      provenance: {
        source: "Snapshot public records indexed by Wallet Face",
        sourceUrl: "https://snapshot.box/#/" + encodeURIComponent(id),
        retrievedAt: new Date().toISOString(),
        scan: jobs[0] || null,
        completeness:
          jobs[0]?.votes_complete && jobs[0]?.proposals_complete
            ? "query-exhausted"
            : "partial",
        limitations:
          "Observed records only; query exhaustion is not universal historical completeness. Private/shielded ballots are never stored. Monthly trends use UTC. Ranges are [start,end). Refreshes are bounded to 100 proposals and 100 votes per page.",
      },
    };
  }
}
