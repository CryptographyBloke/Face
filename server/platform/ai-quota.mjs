import { createHash } from "node:crypto";
import { platformDb } from "./db.mjs";
import { ApiError } from "../validation.mjs";
export function postgresQuota(
  env,
  limits,
  now = () => Date.now(),
  dbFactory = platformDb,
) {
  const getDb = () => dbFactory(env);
  return {
    async reserve(ip) {
      const day = Math.floor(now() / 86400000),
        hour = Math.floor(now() / 3600000),
        hash = createHash("sha256")
          .update(env.FACE_AI_BETA_TOKEN + ":" + ip)
          .digest("hex")
          .slice(0, 24),
        scope = env.VERCEL_ENV || "development";
      try {
        const result = await getDb().query(
          "SELECT face_platform.reserve_budget($1::text[],$2::bigint[],$3::bigint[],now()+interval '2 days') AS ok",
          [
            [
              `ai:${scope}:day:${day}`,
              `ai:${scope}:ip:${hour}:${hash}`,
              `ai:${scope}:reserved:${day}`,
            ],
            [
              limits.globalDailyRequests,
              limits.ipHourlyRequests,
              limits.globalDailyTokens,
            ],
            [1, 1, limits.reservedTokens],
          ],
        );
        if (!result[0]?.ok)
          throw new ApiError(
            429,
            "AI_QUOTA",
            "AI quota reached; retry in the next quota window",
          );
      } catch (e) {
        if (e instanceof ApiError && e.code === "AI_QUOTA") throw e;
        throw new ApiError(
          503,
          "QUOTA_UNAVAILABLE",
          "Shared quota store unavailable; AI execution paused",
        );
      }
    },
    async record(usage) {
      await getDb().query(
        "INSERT INTO face_platform.quota_buckets(key,count,expires_at) VALUES($1,$2,now()+interval '7 days') ON CONFLICT(key) DO UPDATE SET count=face_platform.quota_buckets.count+excluded.count",
        [
          `ai:${env.VERCEL_ENV || "development"}:usage:${Math.floor(now() / 86400000)}`,
          usage.totalTokens || 0,
        ],
      );
    },
  };
}
