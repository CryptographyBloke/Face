import { z } from "zod";
import { address, chain, spaceId, ApiError } from "./validation.mjs";
import { resolveProfile } from "./resolver.mjs";
import { challenge, execute } from "./auth.mjs";

export function createApi({
  snapshot,
  store = null,
  ens = null,
  origin = "http://localhost:5173",
  rateLimit = 60,
  now = () => Date.now(),
}) {
  const buckets = new Map();
  return async (request, clientIp = "local") => {
    const url = new URL(request.url);
    const write = request.method === "POST";
    const requestOrigin = request.headers.get("origin");
    for (const [key, bucket] of buckets)
      if (bucket.reset < now()) buckets.delete(key);
    const headers = {
      "Content-Type": "application/json",
      "X-Content-Type-Options": "nosniff",
      "Cache-Control": "no-store",
      Vary: "Origin",
      "Access-Control-Allow-Origin": requestOrigin === origin ? origin : "*",
    };
    const json = (data, status = 200) =>
      new Response(JSON.stringify(data), { status, headers });
    try {
      const bucket = buckets.get(clientIp);
      const time = now();
      if (!bucket || bucket.reset < time) {
        if (buckets.size >= 5000) buckets.delete(buckets.keys().next().value);
        buckets.set(clientIp, { count: 1, reset: time + 60000 });
      } else if (++bucket.count > rateLimit) {
        headers["Retry-After"] = "60";
        throw new ApiError(
          429,
          "RATE_LIMIT",
          "Request limit exceeded. Retry later.",
        );
      }
      if (request.method === "OPTIONS") {
        if (requestOrigin !== origin)
          throw new ApiError(403, "ORIGIN", "Origin not allowed");
        return new Response(null, {
          status: 204,
          headers: {
            ...headers,
            "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
            "Access-Control-Allow-Headers": "Content-Type",
          },
        });
      }
      if (!["GET", "POST"].includes(request.method))
        throw new ApiError(405, "METHOD", "Method not allowed");
      if (write && requestOrigin !== origin)
        throw new ApiError(
          403,
          "ORIGIN",
          "Publishing requires the configured application origin",
        );
      const parts = url.pathname
        .split("/")
        .filter(Boolean)
        .map((x) => decodeURIComponent(x));
      const page = Math.max(
        0,
        Math.min(100, Number(url.searchParams.get("page") || 0) | 0),
      );
      const limit = 20;
      if (!write && url.pathname === "/health")
        return json({
          ok: true,
          version: "0.4.0",
          mode: store ? "persistent" : "read-only",
          supportedChains: [1],
        });
      if (
        !write &&
        parts[0] === "v1" &&
        ["avatar", "profile"].includes(parts[1]) &&
        parts.length === 4
      ) {
        const p = await resolveProfile(
          { snapshot, store, ens },
          chain(parts[2]),
          address(parts[3]),
        );
        headers["Cache-Control"] = "public, max-age=30";
        return json(
          parts[1] === "avatar"
            ? {
                chainId: p.chainId,
                address: p.address,
                avatar: p.avatar,
                provenance: p.provenance,
                cache: p.cache,
              }
            : p,
        );
      }
      if (
        !write &&
        parts[0] === "v1" &&
        parts[1] === "spaces" &&
        parts[2] &&
        parts.length <= 4
      ) {
        const id = spaceId(parts[2]);
        if (parts[3] === "summary") {
          const space = await snapshot.space(id);
          return json({
            space,
            provenance: {
              source: "snapshot",
              sourceUrl: "https://snapshot.box/#/" + encodeURIComponent(id),
              fetchedAt: new Date(now()).toISOString(),
            },
          });
        }
        const d = await snapshot.directory(id);
        const claim = store?.get("space", id);
        const official =
          !!claim &&
          d.space.admins.some(
            (a) => a.toLowerCase() === claim.issuer.toLowerCase(),
          );
        const badges = store?.list("badge", id) || [];
        const roles = store?.list("role", id) || [];
        const participants = d.participants.map((p) => {
          const profile = store?.get("profile", p.address.toLowerCase());
          return {
            ...p,
            profileClaimed: !!profile?.visible,
            name: profile?.visible ? profile.name : null,
            badges: badges.filter(
              (b) => b.recipient.toLowerCase() === p.address.toLowerCase(),
            ),
            roles: roles.filter(
              (r) => r.recipient.toLowerCase() === p.address.toLowerCase(),
            ),
          };
        });
        if (parts[3] === "members") {
          const sort = url.searchParams.get("sort") || "recent";
          if (!["recent", "votes", "address"].includes(sort))
            throw new ApiError(
              422,
              "INVALID_SORT",
              "Use recent, votes or address sorting",
            );
          const search = (url.searchParams.get("search") || "")
            .slice(0, 100)
            .toLowerCase();
          const selected = participants.filter((p) =>
            (p.address + " " + (p.name || "")).toLowerCase().includes(search),
          );
          selected.sort((a, b) =>
            sort === "votes"
              ? b.publicVotes - a.publicVotes ||
                a.address.localeCompare(b.address)
              : sort === "address"
                ? a.address.localeCompare(b.address)
                : (b.lastVotedAt || 0) - (a.lastVotedAt || 0) ||
                  a.address.localeCompare(b.address),
          );
          return json({
            kind: "public_governance_participants",
            items: selected.slice(page * limit, (page + 1) * limit),
            page,
            pageSize: limit,
            totalObserved: selected.length,
            hasMore: (page + 1) * limit < selected.length,
            provenance: d.provenance,
          });
        }
        if (parts[3] === "activity")
          return json({ items: d.activity, provenance: d.provenance });
        if (parts[3] === "badges")
          return json({ items: badges, provenance: d.provenance });
        if (parts.length === 4)
          throw new ApiError(404, "NOT_FOUND", "Unknown space resource");
        return json({
          space: d.space,
          official,
          branding: official ? claim : null,
          counts: {
            publicParticipantsObserved: participants.length,
            claimedProfilesObserved: participants.filter(
              (p) => p.profileClaimed,
            ).length,
            proposalsObserved: d.proposals.length,
          },
          proposals: d.proposals,
          provenance: d.provenance,
        });
      }
      if (write && ["/v1/challenge", "/v1/execute"].includes(url.pathname)) {
        if (!store)
          throw new ApiError(
            503,
            "READ_ONLY",
            "Signed writes require a persistent API deployment",
          );
        const raw = await request.text();
        if (raw.length > 16000)
          throw new ApiError(413, "BODY_SIZE", "Request too large");
        let body;
        try {
          body = JSON.parse(raw);
        } catch {
          throw new ApiError(400, "JSON", "Invalid JSON");
        }
        if (url.pathname === "/v1/challenge") {
          const b = z
            .object({
              address: z.string(),
              action: z.string(),
              payload: z.unknown(),
            })
            .strict()
            .parse(body);
          return json(challenge(store, origin, b.address, b.action, b.payload));
        }
        const b = z
          .object({
            nonce: z.string().regex(/^0x[0-9a-f]{64}$/),
            signature: z.string().regex(/^0x[0-9a-fA-F]{130}$/),
            payload: z.unknown(),
          })
          .strict()
          .parse(body);
        return json(await execute({ store, snapshot, origin }, b));
      }
      throw new ApiError(404, "NOT_FOUND", "API route not found");
    } catch (e) {
      const status =
        e instanceof ApiError
          ? e.status
          : e instanceof z.ZodError || e instanceof URIError
            ? 400
            : 500;
      return json(
        {
          error: {
            code:
              e instanceof ApiError
                ? e.code
                : status === 400
                  ? "VALIDATION"
                  : "INTERNAL",
            message:
              e instanceof ApiError
                ? e.message
                : status === 400
                  ? "Invalid request or upstream response"
                  : "Unexpected server error",
          },
        },
        status,
      );
    }
  };
}
