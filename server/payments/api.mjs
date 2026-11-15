import { z } from "zod";
import { createHash } from "node:crypto";
import { sessionActor } from "../platform/authorization.mjs";
import { PaymentService } from "./service.mjs";
import { paymentStatus } from "./protocol.mjs";
import { ApiError } from "../validation.mjs";
export function createPaymentApi({
  snapshot,
  origin,
  env = process.env,
  service,
} = {}) {
  let current = service;
  return async (request, ip = "local") => {
    const url = new URL(request.url),
      path = url.pathname.replace("/v1/payments/", "");
    const headers = {
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Expose-Headers":
        "PAYMENT-REQUIRED,PAYMENT-RESPONSE,Retry-After",
    };
    const json = (body, status = 200, extra = {}) =>
      Response.json(body, { status, headers: { ...headers, ...extra } });
    try {
      if (request.method === "OPTIONS")
        return new Response(null, {
          status: 204,
          headers: {
            ...headers,
            "Access-Control-Allow-Methods": "GET, OPTIONS",
            "Access-Control-Allow-Headers": "PAYMENT-SIGNATURE,Authorization",
          },
        });
      if (request.method !== "GET")
        throw new ApiError(405, "METHOD", "Use GET for the paid report");
      if (path === "status") return json(paymentStatus(env));
      if (!paymentStatus(env).enabled && !service)
        throw new ApiError(
          503,
          "PAYMENTS_DISABLED",
          "Testnet payments are disabled or unconfigured",
        );
      current ||= new PaymentService({ snapshot, origin, env });
      if (current.repository.db) {
        const bucket = Math.floor(Date.now() / 3600000),
          hash = createHash("sha256")
            .update((env.FACE_SESSION_SECRET || "") + ip)
            .digest("hex")
            .slice(0, 24);
        const r = await current.repository.db.query(
          "SELECT face_platform.reserve_quota($1::text[],$2::bigint[],now()+interval '2 hours') AS ok",
          [
            [`payments:${bucket}`, `payments:${bucket}:${hash}`],
            [100, 15],
          ],
        );
        if (!r[0]?.ok)
          throw new ApiError(
            429,
            "PAYMENT_RATE_LIMIT",
            "Testnet request quota reached; retry later",
          );
      }
      if (path === "receipts") {
        const payer = sessionActor(request, origin, env);
        return json({ items: await current.repository.list(payer) });
      }
      const match = path.match(/^receipts\/([0-9a-f-]+)$/i);
      if (match) {
        const id = z.string().uuid().parse(match[1]),
          payer = sessionActor(request, origin, env),
          r = await current.repository.receipt(id);
        if (!r || r.payer !== payer)
          throw new ApiError(404, "RECEIPT_NOT_FOUND", "Receipt not found");
        const result = await current.replay(r);
        return json(result.data, result.status, result.headers);
      }
      if (path === "report") {
        const input = z
          .object({
            spaceId: z.string().regex(/^[a-z0-9][a-z0-9._-]{0,99}$/),
            requestId: z.string().uuid(),
          })
          .strict()
          .parse(Object.fromEntries(url.searchParams));
        const result = await current.report(
          input.requestId,
          input.spaceId,
          request.headers.get("payment-signature"),
          request.signal,
        );
        return json(result.data, result.status, result.headers);
      }
      throw new ApiError(404, "NOT_FOUND", "Payment route not found");
    } catch (e) {
      const validation = e instanceof z.ZodError;
      return json(
        {
          error: {
            code: validation ? "PAYMENT_INPUT" : e.code || "PAYMENT_UPSTREAM",
            ...(validation
              ? {
                  fields: e.issues.map((i) => ({
                    path: i.path,
                    code: i.code,
                    keys: i.keys,
                  })),
                }
              : {}),
            message: validation
              ? "Invalid payment parameters: " +
                e.issues
                  .map((i) =>
                    i.code === "unrecognized_keys"
                      ? "unexpected " + i.keys.join(",")
                      : i.path.join("."),
                  )
                  .join("; ")
              : e instanceof ApiError
                ? e.message
                : "Payment service unavailable; inspect receipts before retrying",
          },
        },
        validation ? 400 : e instanceof ApiError ? e.status : 503,
      );
    }
  };
}
