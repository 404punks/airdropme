# AirdropMe

Public Pump.fun statistics, a campaign point score, a leaderboard, and Solana claim registration.

Wallet connection is used only on the claim page. Profile submission accepts a `pump.fun` profile URL, a username, or a Solana address. The server resolves that identifier through fixed Pump.fun API paths. It does not fetch an arbitrary URL.

## What is verified

Live mode calls `https://frontend-api-v3.pump.fun` without an API key:

- Profile overview, including the canonical wallet and follower count
- All-time Callouts created from `callout-stats`
- Likes and reposts by summing paginated `GET /callout/list/{userId}` rows, deduped by Callout id

Unavailable on purpose:

- A separate retweet count
- `GET /users/{address}/social-stats` (`401` without a token)
- `GET /callout/leaderboard` (`401` without a token)
- Follower lists (`403`)
- Token transfers. Claims are registrations unless a real distributor is added later.

Details, including observed rate-limit headers, are in [docs/API_FEASIBILITY.md](docs/API_FEASIBILITY.md).

Points are recomputed from current cumulative totals. A refresh replaces the score. Unavailable and incomplete metrics are not scored. Points do not guarantee a token allocation or any financial return.

## Stack

Next.js App Router, TypeScript, Tailwind CSS, shadcn-style UI primitives, Postgres via Supabase when `DATABASE_URL` is set, and Solana Wallet Adapter (Phantom and Solflare) for the claim signature.

Without `DATABASE_URL` (or `POSTGRES_URL`), profile pages still load public Pump.fun statistics. The leaderboard is written to `data/airdropme-store.json` on a single server. Serverless hosts do not share that file, so set Postgres when rankings must survive across instances. A banner explains that mode.

## Local development

```bash
cp .env.example .env.local
# Set ADMIN_EMAIL, ADMIN_PASSWORD, and ADMIN_SESSION_SECRET (16+ characters) to open /admin.
npm install
npm test
npm run dev
```

Open http://localhost:3000.

Set `PUMPFUN_DATA_MODE=demo` only when you want the labeled `DEMO_alpha` fixture. The default is `live`.

## Database

Apply [supabase/migrations/0001_init.sql](supabase/migrations/0001_init.sql) to Supabase or any Postgres:

```bash
DATABASE_URL="postgres://..." npm run db:migrate
```

The migration creates users, submitted profiles, statistic snapshots, Callout records, the point ledger, leaderboard cache, campaigns, claims, nonces, admin settings, fetch failures, and audit logs. It does not store private keys or seed phrases.

## Deployment

The app is Vercel-compatible.

1. Create a Supabase Postgres database and run the migration.
2. Set the environment variables from `.env.example` in the host. Set `DATABASE_URL` or `POSTGRES_URL` so the leaderboard is shared in production. Keep `PUMPFUN_API_TOKEN` empty unless you have an operator credential, and never prefix secrets with `NEXT_PUBLIC_`.
3. Leave `DISTRIBUTION_ENABLED=false`. Turning it on does not send tokens; the claim is stored as failed because no verified program is configured.
4. Deploy with `npm run build`.

Scheduled refreshes are not included. Vercel cron can call a future job, but this build refreshes when a visitor submits or an owner presses Refresh, and it caches snapshots for `STATS_CACHE_TTL_SECONDS`.

## Free versus paid

| Capability | Requirement |
| --- | --- |
| Profile, followers, Callout totals, paged likes and reposts | Public Pump.fun routes. No key in this check. Rate limits apply. |
| Social-stats and the global Callout leaderboard | Not public. Not used. |
| Postgres persistence and admin across instances | Supabase or another Postgres. |
| Hosting | A Node host such as Vercel. |
| Wallet signature | User's Phantom or Solflare. No payment. |
| Token distribution | Not implemented. Needs a funded, reviewed program before it can be honest. |

## Tests

```bash
npm test
npm run typecheck
```

Covered logic includes identifier validation, unavailable metrics, Callout dedupe and incomplete pages, point math, duplicate profiles, rate limits, wallet signatures, and duplicate claims.

## Security notes

- External fetches are limited to the allowlisted Pump.fun host and relative paths.
- Submission bodies cannot choose the upstream URL.
- Admin routes check a server session. Hiding a link is not the control.
- Claim eligibility and points are read on the server.
- IP addresses are stored only as a salted hash.
- The claim message states that the signature does not transfer tokens.
