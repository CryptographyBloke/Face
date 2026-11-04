# Wallet Face API

A Cloudflare Worker that turns any Ethereum address or ENS name into an avatar. It also runs the paid developer product: API keys, monthly quotas and Stripe subscriptions.

## Endpoints

| Method | Path | Auth | Purpose |
|---|---|---|---|
| GET | `/v1/avatar/{address\|ens}` | optional key | JSON record: `address`, `ens`, `avatar { uri, url, gateways, source }` |
| GET | `/v1/avatar/{address\|ens}/image?s=256&fallback=identicon\|404` | none | The image itself, proxied with gateway fallback and edge caching. Wallets with no avatar get an identicon. |
| POST | `/v1/avatars` `{ "ids": [...] }` | API key | Batch lookup (Snapshot profiles), up to the plan's batch size |
| GET | `/v1/plans` | none | Plan catalogue and whether online billing is enabled |
| GET | `/v1/auth/nonce?address=0x…` | none | Wallet sign-in challenge |
| POST | `/v1/auth/verify` | none | `{ address, nonce, signature }` → session token (7 days) |
| GET | `/v1/account` | session | Plan, usage, key prefix, subscription |
| POST | `/v1/account/keys` | session | Create or rotate the API key. The full key is returned once. |
| POST | `/v1/billing/checkout` | session | `{ plan: "pro" \| "business" }` → Stripe Checkout URL |
| POST | `/v1/billing/portal` | session | Stripe customer portal URL |
| POST | `/v1/billing/webhook` | Stripe signature | Keeps plans in sync with subscriptions |

**How lookups resolve:**
1. The Snapshot profile is checked first.
2. If there isn't one, the ENS avatar is used (single lookups only).
3. `ipfs://` and `ar://` URIs are expanded into the configured list of gateways.

**Metering:**
- **Keyed requests** count toward the monthly quota, and each address in a batch counts as one request.
- **Anonymous JSON requests** are rate-limited per IP.
- **Image requests** are cached at the edge. Only cache misses count toward the per-IP image limit.

**Security:**
- API keys are stored as SHA-256 hashes.
- Sign-in nonces are single-use and expire after 10 minutes.
- Session tokens are signed with HMAC.
- Stripe webhooks are verified, with a 5-minute window for their timestamps.
- Proxied images are served with `nosniff` and a sandboxing CSP.

## Deploy (first time)

You need a Cloudflare account (the free plan works to start).

```bash
cd api
npm install
npx wrangler login
```

```bash
npx wrangler d1 create wallet-face
```

Paste the printed `database_id` into `wrangler.toml`, then:

```bash
npm run db:migrate:remote
```

```bash
openssl rand -hex 32 | npx wrangler secret put SESSION_SECRET
```

```bash
npm run deploy
```

Then serve the API on its own domain. Uncomment the `routes` line in `wrangler.toml` (for example `api.dao.sarl`) and deploy again. The web app expects `VITE_API_URL` to point here, and the default is `https://api.dao.sarl`.

### Turn on paid plans (Stripe)

1. In Stripe, create two recurring prices: Pro at $19/month and Business at $99/month.
2. Add a webhook endpoint at `https://<api-domain>/v1/billing/webhook` with these events:
   - `checkout.session.completed`
   - `customer.subscription.created`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
3. Turn on the customer portal (Settings → Billing → Customer portal).
4. Store the keys as secrets:

```bash
npx wrangler secret put STRIPE_SECRET_KEY
```

```bash
npx wrangler secret put STRIPE_WEBHOOK_SECRET
```

```bash
npx wrangler secret put STRIPE_PRICE_PRO
```

```bash
npx wrangler secret put STRIPE_PRICE_BUSINESS
```

Until these are set, the pricing page shows "Contact us" for paid plans. You can still upgrade an account by hand:

```bash
npx wrangler d1 execute wallet-face --remote --command "UPDATE accounts SET plan='pro' WHERE address='0x…lowercase…'"
```

## Develop

```bash
cp .dev.vars.example .dev.vars
```

```bash
npm run db:migrate:local
```

```bash
npm run dev
```

```bash
npm test
```

The tests run against real SQLite through Node's built-in `node:sqlite` (Node 22.5 or later), with the same migrations as production. Snapshot, the gateways and Stripe are mocked.

## Known limits

- Usage counters are written to D1 after each response. Under very heavy concurrent traffic a few requests can go past a quota before the check catches up. If that matters, move the counters to a Durable Object.
- Batch lookups only use Snapshot profiles; the ENS fallback applies to single lookups only.
- Sign-in from smart-contract wallets (ERC-1271) needs `ETH_RPC_URL` to be reachable.
