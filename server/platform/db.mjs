import { neon } from "@neondatabase/serverless";
import { ApiError } from "../validation.mjs";
export function platformDb(env = process.env) {
  if (!env.FACE_DATABASE_URL)
    throw new ApiError(
      503,
      "PLATFORM_STORAGE",
      "Agent platform database is not configured",
    );
  const sql = neon(env.FACE_DATABASE_URL);
  return {
    query: (text, params = []) =>
      sql.query(text, params, {
        fetchOptions: { signal: AbortSignal.timeout(10000) },
      }),
    transaction: (statements) =>
      sql.transaction(
        statements.map(([text, params = []]) => sql.query(text, params)),
      ),
  };
}
