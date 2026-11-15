import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import { ApiError } from "../validation.mjs";
export function providerConfig(env = process.env) {
  const provider = env.FACE_AI_PROVIDER || "newapi";
  if (provider === "gateway")
    return {
      provider,
      model: env.AI_GATEWAY_MODEL || null,
      configured:
        !!env.AI_GATEWAY_MODEL &&
        !!(env.AI_GATEWAY_API_KEY || env.VERCEL_OIDC_TOKEN),
      missing: [
        ...(!env.AI_GATEWAY_MODEL ? ["AI_GATEWAY_MODEL"] : []),
        ...(!env.AI_GATEWAY_API_KEY && !env.VERCEL_OIDC_TOKEN
          ? ["AI Gateway authentication"]
          : []),
      ],
    };
  if (provider !== "newapi")
    return {
      provider,
      model: null,
      configured: false,
      missing: ["FACE_AI_PROVIDER (newapi or gateway)"],
    };
  let valid = false;
  try {
    const u = new URL(env.NEWAPI_BASE_URL);
    valid =
      (u.protocol === "https:" ||
        (u.protocol === "http:" && env.NEWAPI_ALLOW_HTTP === "true")) &&
      !u.username &&
      !u.password &&
      !u.search &&
      !u.hash &&
      /\/v1\/?$/.test(u.pathname);
  } catch {}
  const missing = [
    ...(!valid
      ? [
          "NEWAPI_BASE_URL (https://host/v1, or explicit NEWAPI_ALLOW_HTTP=true)",
        ]
      : []),
    ...(!env.NEWAPI_API_KEY ? ["NEWAPI_API_KEY"] : []),
    ...(!env.NEWAPI_MODEL ? ["NEWAPI_MODEL"] : []),
  ];
  return {
    provider,
    model: env.NEWAPI_MODEL || null,
    configured: !missing.length,
    missing,
  };
}
export function configuredModel(env = process.env, { fetchImpl } = {}) {
  const c = providerConfig(env);
  if (!c.configured)
    throw new ApiError(
      503,
      "MODEL_CONFIG",
      "Model provider configuration is incomplete",
    );
  if (c.provider === "gateway") return c.model;
  return createOpenAICompatible({
    name: "newapi",
    baseURL: env.NEWAPI_BASE_URL.replace(/\/$/, ""),
    apiKey: env.NEWAPI_API_KEY,
    includeUsage: true,
    ...(fetchImpl ? { fetch: fetchImpl } : {}),
  }).chatModel(c.model);
}
