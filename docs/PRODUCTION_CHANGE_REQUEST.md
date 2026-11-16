# Production change request / 正式发布变更

**Outcome:** owner approved on 2026-11-15; all four migrations and v0.5 production deployment completed. See V05_PRODUCTION_ACCEPTANCE.md. The request below is retained as the approved change scope.

Owner review target: Wallet Face Agent platform code `38a78d1b0c61a9b77b535dfd1a342311b70c4d8d`.
PR https://github.com/CryptographyBloke/Face/pull/4 .
Validated application Preview: https://walletface-3sx17fb8b-dao-vote.vercel.app .

The owner authorized production promotion after acceptance. Automatic approval review separately rejected the formal schema application as a consequential production migration requiring specific confirmation.

## Exact pending change

Apply these checked-in migrations to **the new empty `walletface_production` database**, Neon project `soft-paper-81147406`, branch `br-long-shadow-bcv90uho`:

1. `server/platform/migrations/001_platform.sql`: isolated face_platform schema, version records and tables for challenges, agents, reports, organizations, actions, organization records, audits, public index/checkpoints and quotas.
2. `002_authorized_writes.sql`: atomic authorization consumption, version checks, approved internal actions and audit insertion.
3. `003_index_and_quota.sql`: index leases/page transaction and shared request quota reservation.
4. `004_ai_budget.sql`: weighted atomic AI request/token reservations.

Read-only inspection after the rejection confirmed **zero face_platform tables**. No production schema changes were applied.
The same schema passed real Preview signature/replay/concurrency/workflow/quota tests.

After approval: create a database-scoped runtime role; configure formal server secrets/model beta/quota settings using the existing Vercel project;
build and validate the production candidate; promote to walletface.org; smoke-check public routes and preserve the rollback deployment.
The model remains owner beta: five requests/day, shared quotas, no automatic retries. No paid service/plan/quota increase is included.

## Existing data and rollback

Existing wallet/avatar publishing and legacy SQLite authorization are independent; no existing profile/admin authorization data is copied or migrated.
No registry contract is deployed. Agent actions affect Wallet Face records only; no chain transaction, Snapshot vote or third-party message is submitted.
Keep the current domain deployment `dpl_GjPfmyukWFpKuzk5AYHS83YxF9vD` (source `3f505dc3`) as the rollback target.
If production acceptance fails, retain the old domain deployment and disable the new platform/model switches.
New data lives in its isolated database. Restore validation is required before any later destructive migration or legacy-store transfer.

The external service-domain and registry ownership integrations still require operator evidence and a trusted RPC respectively;
no live verification claim is made for those unconfigured integrations. Remaining external adapters are in AGENT_IDENTITY_ROADMAP.md.
