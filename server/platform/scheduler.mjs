import { timingSafeEqual } from "node:crypto";
import { ApiError } from "../validation.mjs";
export async function scheduledRefresh(
  request,
  { env, repository, index, snapshot },
) {
  const expected = Buffer.from("Bearer " + (env.CRON_SECRET || "")),
    got = Buffer.from(request.headers.get("authorization") || "");
  if (
    env.FACE_SCHEDULED_REFRESH !== "true" ||
    !env.CRON_SECRET ||
    env.CRON_SECRET.length < 32 ||
    expected.length !== got.length ||
    !timingSafeEqual(expected, got)
  )
    throw new ApiError(
      403,
      "SCHEDULER_DISABLED",
      "Scheduled refresh is disabled or unauthorized",
    );
  // Fixed upper bound: at most three opted-in spaces, one bounded page each.
  const organizations = await repository.db.query(
    "SELECT o.space_id,o.admin FROM face_platform.organizations o LEFT JOIN face_platform.scan_jobs j ON j.space_id=o.space_id WHERE o.config->>'refreshEnabled'='true' ORDER BY j.updated_at ASC NULLS FIRST LIMIT 3",
  );
  const results = [];
  for (const o of organizations) {
    try {
      const s = await snapshot.space(o.space_id, true);
      if (!s.admins.some((a) => a.toLowerCase() === o.admin)) {
        results.push({ spaceId: o.space_id, status: "administrator_changed" });
        continue;
      }
      const r = await index.refresh(o.space_id);
      results.push({
        spaceId: o.space_id,
        status: "refreshed",
        votesFetched: r.votesFetched,
        completeness: r.provenance.completeness,
      });
    } catch {
      results.push({
        spaceId: o.space_id,
        status: "failed_retry_next_schedule",
      });
    }
  }
  return { checkedAt: new Date().toISOString(), results };
}
