import { neon } from "@neondatabase/serverless";
import { ApiError } from "../validation.mjs";
export function platformDb(env = process.env) {
  const connection =
    env.FACE_IDENTITY_ENABLED === "true"
      ? env.FACE_IDENTITY_DATABASE_URL || env.FACE_DATABASE_URL
      : env.FACE_DATABASE_URL;
  if (!connection)
    throw new ApiError(
      503,
      "PLATFORM_STORAGE",
      "Agent platform database is not configured",
    );
  const sql = neon(connection);
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
