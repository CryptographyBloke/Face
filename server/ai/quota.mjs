import { postgresQuota } from "../platform/ai-quota.mjs";
import { createHash, timingSafeEqual } from "node:crypto";
import { providerConfig } from "./provider.mjs";
import { ApiError } from "../validation.mjs";
export const LIMITS = Object.freeze({
  bodyBytes: 16000,
  history: 8,
  inputBytes: 10000,
  steps: 4,
  toolCalls: 6,
  outputPerStep: 800,
  contextBytes: 40000,
  timeoutMs: 45000,
  reservedTokens: 200000,
  globalDailyRequests: 5,
  ipHourlyRequests: 3,
  globalDailyTokens: 1000000,
});
export function quotaSecret(env) {
  return env.FACE_SESSION_SECRET || env.FACE_AI_BETA_TOKEN || "";
}
export function aiLimits(env = process.env) {
  const publicAccess = env.FACE_AI_ACCESS === "public";
  const limits = { ...LIMITS };
  const options = [
    [
      "globalDailyRequests",
      "FACE_AI_DAILY_REQUESTS",
      publicAccess ? 200 : 5,
      10000,
    ],
    [
      "ipHourlyRequests",
      "FACE_AI_IP_HOURLY_REQUESTS",
      publicAccess ? 10 : 3,
      100,
    ],
    [
      "globalDailyTokens",
      "FACE_AI_DAILY_RESERVED_TOKENS",
      publicAccess ? 40000000 : 1000000,
      2000000000,
    ],
  ];
  for (const [key, name, fallback, maximum] of options) {
    const raw = env[name];
    const value = raw === undefined ? fallback : Number(raw);
    if (!Number.isSafeInteger(value) || value < 1 || value > maximum)
      throw new ApiError(503, "AI_CONFIG", `Invalid ${name}`);
    limits[key] = value;
  }
  if (limits.globalDailyTokens < limits.reservedTokens)
    throw new ApiError(
      503,
      "AI_CONFIG",
      "Daily token reservation is below one request",
    );
  return Object.freeze(limits);
}
export function aiStatus(env = process.env) {
  const missing = [];
  if (env.FACE_AI_ENABLED !== "true") missing.push("FACE_AI_ENABLED");
  const config = providerConfig(env);
  missing.push(...config.missing);
  const access = env.FACE_AI_ACCESS || "beta";
  if (!["public", "beta"].includes(access))
    missing.push("FACE_AI_ACCESS (public or beta)");
  if (
    access === "beta" &&
    (!env.FACE_AI_BETA_TOKEN || env.FACE_AI_BETA_TOKEN.length < 32)
  )
    missing.push("FACE_AI_BETA_TOKEN (32+ characters)");
  if (quotaSecret(env).length < 32)
    missing.push("server quota hashing secret (32+ characters)");
  let limits = LIMITS;
  try {
    limits = aiLimits(env);
  } catch (e) {
    missing.push(e.message);
  }
  if (env.FACE_AI_QUOTA_STORE === "postgres") {
    if (!env.FACE_DATABASE_URL) missing.push("shared Postgres quota store");
  } else if (!env.UPSTASH_REDIS_REST_URL || !env.UPSTASH_REDIS_REST_TOKEN)
    missing.push("shared Redis quota store");
  return {
    available: missing.length === 0,
    mode: missing.length
      ? "data-only"
      : access === "public"
        ? "public"
        : "restricted-beta",
    missing,
    model: config.model,
    provider: config.provider,
    readOnly: true,
    tools: [
      "getWalletProfile",
      "getSpace",
      "listParticipants",
      "getGovernanceActivity",
      "getProposal",
      "analyzeParticipation",
    ],
    limits,
  };
}
export function authorizeBeta(request, env) {
  if (env.FACE_AI_ACCESS === "public") return;
  const value = request.headers.get("authorization") || "";
  const expected = "Bearer " + env.FACE_AI_BETA_TOKEN;
  const a = Buffer.from(value),
    b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b))
    throw new ApiError(401, "BETA_ACCESS", "Owner beta access key required");
}
const script = `local a=tonumber(redis.call('GET',KEYS[1]) or '0') local b=tonumber(redis.call('GET',KEYS[2]) or '0') local c=tonumber(redis.call('GET',KEYS[3]) or '0') if a>=tonumber(ARGV[1]) or b>=tonumber(ARGV[2]) or c+tonumber(ARGV[3])>tonumber(ARGV[4]) then return 0 end redis.call('INCR',KEYS[1]) redis.call('EXPIRE',KEYS[1],172800) redis.call('INCR',KEYS[2]) redis.call('EXPIRE',KEYS[2],7200) redis.call('INCRBY',KEYS[3],ARGV[3]) redis.call('EXPIRE',KEYS[3],172800) return 1`;
export function createQuota(
  env = process.env,
  fetchImpl = fetch,
  now = () => Date.now(),
) {
  if (env.FACE_AI_QUOTA_STORE === "postgres")
    return postgresQuota(env, aiLimits(env), now, undefined, quotaSecret(env));
  async function command(args) {
    if (
      !/^https:\/\/[^/]+\.upstash\.io\/?$/.test(
        env.UPSTASH_REDIS_REST_URL || "",
      )
    )
      throw new ApiError(
        503,
        "QUOTA_CONFIG",
        "Configure the shared Upstash HTTPS endpoint",
      );
    try {
      const r = await fetchImpl(env.UPSTASH_REDIS_REST_URL, {
        method: "POST",
        headers: {
          Authorization: "Bearer " + env.UPSTASH_REDIS_REST_TOKEN,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(args),
        signal: AbortSignal.timeout(4000),
      });
      const b = await r.json();
      if (!r.ok || b.error) throw new Error();
      return b.result;
    } catch {
      throw new ApiError(
        503,
        "QUOTA_UNAVAILABLE",
        "Shared quota store unavailable; AI execution paused",
      );
    }
  }
  return {
    async reserve(ip) {
      const limits = aiLimits(env);
      const day = Math.floor(now() / 86400000),
        hour = Math.floor(now() / 3600000);
      const hash = createHash("sha256")
        .update(quotaSecret(env) + ":" + ip)
        .digest("hex")
        .slice(0, 24);
      const ok = await command([
        "EVAL",
        script,
        "3",
        `face:ai:v1:day:${day}`,
        `face:ai:v1:ip:${hour}:${hash}`,
        `face:ai:v1:tokens:${day}`,
        String(limits.globalDailyRequests),
        String(limits.ipHourlyRequests),
        String(limits.reservedTokens),
        String(limits.globalDailyTokens),
      ]);
      if (ok !== 1)
        throw new ApiError(
          429,
          "AI_QUOTA",
          "AI quota reached; retry in the next quota window",
        );
    },
    async record(usage) {
      await command([
        "HINCRBY",
        `face:ai:v1:usage:${Math.floor(now() / 86400000)}`,
        "totalTokens",
        String(usage.totalTokens || 0),
      ]);
      await command([
        "EXPIRE",
        `face:ai:v1:usage:${Math.floor(now() / 86400000)}`,
        "604800",
      ]);
    },
  };
}
