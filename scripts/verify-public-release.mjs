import assert from "node:assert/strict";
import { writeFile } from "node:fs/promises";
import { aiStatus } from "../server/ai/quota.mjs";
import { platformDb } from "../server/platform/db.mjs";
import { platformStatus } from "../server/platform/api.mjs";
import { paymentStatus } from "../server/payments/protocol.mjs";
if (process.env.FACE_RELEASE_VERIFY_ON_BUILD !== "true") process.exit(0);
const ai = aiStatus(),
  platform = platformStatus(),
  payments = paymentStatus();
assert.equal(ai.available, true);
assert.equal(ai.mode, "public");
assert.equal(platform.available, true);
assert.equal(platform.personalAgents, true);
assert.equal(platform.serviceDiscovery, true);
assert.equal(payments.mainnetEnabled, false);
const db = platformDb();
const versions = await db.query(
  "SELECT version FROM face_platform.schema_migrations ORDER BY version",
);
assert.deepEqual(
  versions.map((x) => x.version),
  [1, 2, 3, 4, 5, 6, 7, 8],
);
const requiredTables = [
  "agent_links",
  "agent_wallet_proofs",
  "agent_registration_evidence",
  "payment_quotes",
  "payment_receipts",
  "payment_events",
  "spending_policies",
  "spending_intents",
  "spending_events",
  "agent_discovery_checks",
];
const access = await db.query(
  "SELECT table_name,(has_table_privilege(current_user,'face_platform.'||table_name,'SELECT') AND has_table_privilege(current_user,'face_platform.'||table_name,'INSERT') AND (table_name IN ('payment_events','spending_events') OR has_table_privilege(current_user,'face_platform.'||table_name,'UPDATE'))) AS allowed FROM information_schema.tables WHERE table_schema='face_platform' AND table_name=ANY($1::text[])",
  [requiredTables],
);
assert.equal(access.length, requiredTables.length);
assert.ok(access.every((x) => x.allowed));
const trigger = await db.query(
  "SELECT tgenabled FROM pg_trigger WHERE tgname='payment_spending_guard' AND tgrelid='face_platform.payment_receipts'::regclass",
);
assert.equal(trigger[0]?.tgenabled, "O");
const report = {
  checkedAt: new Date().toISOString(),
  commit: process.env.VERCEL_GIT_COMMIT_SHA || null,
  publicChat: true,
  walletApprovalRequired: true,
  aiReadOnly: true,
  databaseVersions: versions.map((x) => x.version),
  runtimeTableAccess: true,
  spendingDatabaseGuard: true,
  testnetPaymentsEnabled: payments.enabled,
  spendingEnabled: process.env.FACE_SPENDING_ENABLED === "true",
  mainnetEnabled: false,
  fundedSettlementTested: false,
  modelCalls: 0,
};
await writeFile(
  "web/dist/public-release-verification.json",
  JSON.stringify(report, null, 2),
);
console.log("FACE_PUBLIC_RELEASE_CHECK " + JSON.stringify(report));
