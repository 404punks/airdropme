# Pump.fun API feasibility

Checked on 13 October 2026. The community repository [BankkRoll/pumpfun-apis](https://github.com/BankkRoll/pumpfun-apis) was used as a map only. It is unofficial, and several captured URLs were Next.js page requests (`_rsc`) attributed to `advanced-api-v2.pump.fun`.

## What resolved

| Host | Result |
| --- | --- |
| `https://frontend-api-v3.pump.fun` | Responds. This is the host the app calls. |
| `https://frontend-api.pump.fun` | Cloudflare 1016, origin DNS error. |
| `https://advanced-api-v2.pump.fun` | Cloudflare 1016, origin DNS error. |
| `https://profile-api.pump.fun/health` | `200` with a service status. No public stats schema was found at the obvious documentation paths. |

No request below sent an `Authorization` header.

## Fields this product needs

| Field | Endpoint | Method | Parameters | Auth | Pagination | Free / public | Returned or calculated |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Profile id, username, canonical Solana wallet | `/users/{id}` then `/users/{wallet-or-uuid}/overview` | GET | `/users/{id}` accepts a username, wallet, or UUID. `/overview` rejects a username with `400` and requires a wallet or user UUID | None observed. `200` | None | Yes, at the time of the check | Direct: `profile.userId`, `profile.username`, `profile.canonical_svm_wallet` |
| Followers | `/users/{id}/overview` | GET | same | None observed | None | Yes | Direct: `counts.followers` |
| Followers fallback | `/following/v3/followers/count/{userId}` | GET | user id or wallet | None observed. `200` with `{ "count": number }` | None | Yes | Direct `count` |
| Following count | `/following/v3/following/count/{userId}` | GET | user id or wallet | None observed | None | Yes | Direct `count`. This is following, not followers, and is not scored. |
| Callouts created | `/users/{address}/callout-stats` | GET | wallet or user id | None observed. The client schema describes it as public. | None. Response includes `daily`, `weekly`, `monthly`, `allTime`, `computedAt` | Yes | Direct: `allTime.totalCallouts` |
| Individual Callouts | `/callout/list/{userId}` | GET | `limit`, `sortBy` = `TIMESTAMP` or `MULTIPLE`, `sortOrder` = `ASC` or `DESC`, optional `pageToken`, optional `window` | None observed | `nextPageToken` is `""` on the last page. Page on the token, not on row count. | Yes | Each row includes `calloutId`, `likes`, `repostCount`, `coinMint`. Live `createdAt` was epoch milliseconds, not an ISO string. |
| Likes received | same list | GET | same | None observed | same | Yes | Calculated: sum of `likes` after dedupe by `calloutId` |
| Reposts received | same list | GET | same | None observed | same | Yes | Calculated: sum of `repostCount`. Schema text says quotes are not included in `repostCount`. |
| Retweets | none |  |  |  |  | Not available | Unavailable. The app does not substitute reposts. |
| Nightly social rollup, profile views | `/users/{address}/social-stats` | GET | address | `401 Unauthorized` without a token | Unknown | Not verified as public | Not used. It may be private analytics. |
| Global Callout leaderboard | `/callout/leaderboard` | GET | `limit` | `401 Unauthorized` | Unknown | Not public in this check | Not used |
| Follower list | `/following/followers/{id}` and `/following/{userId}` | GET | id | `403` `Client not allowed` | Unknown | Not public | Not used |

A wallet that the API does not recognize as a profile is not scored. `GET /users/{id}/overview` can return `profile: null` for an external wallet. A username that does not exist returns `404` `User not found`.

## Rate limits

The community README says limits vary and names `x-ratelimit-limit`, `x-ratelimit-remaining`, and `x-ratelimit-reset`. During this check those headers were present and differed by route. Examples observed, not a published quota:

- `GET /users/{id}`: limit 30, reset 60
- `GET /users/{id}/overview`: limit 60, reset 60
- `GET /users/{id}/callout-stats`: limit 30, reset 60
- `GET /callout/list/{userId}`: limit 60, reset 60
- `GET /following/v3/followers/count/{userId}`: limit 50, reset 60

The app retries `429` and `5xx` with backoff, caps Callout pages, and caches snapshots. It does not promise unlimited free use.

## Authentication

The verified reads above succeeded with `Accept: application/json` and `Origin: https://pump.fun` and no bearer token. `PUMPFUN_API_TOKEN` is optional and, when set, is attached only on the server. It is not sent to the browser. This app still does not call `social-stats` or the Callout leaderboard, because those were unauthorized and may not be public data.

## Scoring consequences

- Followers and Callout totals can be scored when the public endpoints return numbers.
- Likes and reposts are scored only when the paged list finishes and the deduped row count matches `allTime.totalCallouts`.
- A distinct retweet total is Unavailable and scores nothing.
- Zeros are stored only when the API says the total is zero.
- Demo mode is explicit (`PUMPFUN_DATA_MODE=demo`) and is labeled DEMO.

## Distribution

No funded claim program is included. Claim registration verifies a wallet signature and eligibility, then stores a record. It does not transfer tokens.
