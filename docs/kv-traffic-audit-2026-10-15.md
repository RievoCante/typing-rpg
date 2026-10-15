# KV quota and traffic audit, 2026-10-15

## Confirmed resource

Cloudflare account `2f3c4cf05dd016ffe51fcf7d262cb501`, Worker
`typing-rpg-backend`, namespace `RATE_LIMIT_KV`
(`0e8f22caff7a40f596a9bcded20f2f6f`). Live bindings match `backend/wrangler.toml`.
The namespace dashboard showed about 1.1k writes over the selected last 24 hours
and 7.8k writes month to date. `RAIDS_KV` showed zero writes month to date.
Cloudflare's free KV allowance is 1,000 writes per UTC day; a rolling 24-hour
dashboard window is not the same as that quota window.

The old middleware performs one KV read and write for every protected API request,
including requests it later rejects. A local replay of the actual middleware,
with a mock 1,000-write daily cap and a request every five seconds, fails on
request 1,001 after about 83 minutes. This demonstrates the code's write pressure,
not the source of production traffic.

## Production traffic evidence

Read-only Workers Observability queries used the last 24 hours on October 15,
around 10:30 Bangkok. Filters and grouping were applied through the dashboard;
no production settings were changed. Results are bounded and may be sampled by
Cloudflare. Relative windows moved between queries; counts should not be summed
into an exact common total.

With `exists($workers.event.request.headers.user-agent)` and grouping by
`$workers.event.request.path`, leading counts were:

| Path | Recorded events with request user-agent |
| --- | ---: |
| `/api/sessions` | 1,562 |
| `/api/me` | 1,280 |
| `/api/me/vault/select` | 105 |
| `/api/leaderboard/levels` | 54 |
| `/api/me/vault` | 36 |
| `/api/daily/status` | 27 |
| `/api/events` | 24 |

A separate exact-path query for `/api/raid/rooms` returned one record. These counts
include methods such as OPTIONS; they are not counts of successful saves or
unique players. Raid polling is a plausible source of future write pressure,
but was not the dominant observed endpoint in this window.

Grouping by request user-agent showed conventional Firefox/Chrome/Edge strings
dominating the leading groups (1,630, 1,193 and 178 events respectively). Named
automated clients were present at low volume: Palo Alto scanning user-agent five,
OAI-SearchBot one, GPTBot one. User-agent claims are spoofable. The observed
combination of game/account routes, session writes and browser preflight requests
is consistent with browser game usage, but cannot prove all traffic is human or
exclude authenticated automation. No definitive person/bot attribution is made.

The event stream also showed `/api/me`, `/api/me/vault`, `/api/daily/status`,
leaderboard and session requests returning HTTP 500 around 06:45–06:47 Bangkok,
before the 07:00 quota reset. Log event error totals include multiple events per
invocation, so they must not be reported as failed-request totals.

## Implemented mitigation

- Replace the KV counter with the native `API_RATE_LIMITER` binding, 120 calls per
  60 seconds, using stable distinct user/IP keys. No KV fallback. Missing binding
  and service errors fail closed. Denials return 429 with a conservative 60-second
  Retry-After. Native limits are per Cloudflare location and eventually consistent;
  they are not exact global accounting. Namespace integer `1001` is unused in this
  repository, but uniqueness across unrelated account Workers was not established.
- Poll Raid room lists 30 seconds after completion, pause and abort while hidden,
  refresh on return, and ignore stale responses after phase exit/unmount. This
  cuts the periodic visible-tab request rate by about 83% versus five seconds,
  and prevents background polling. Remote KV namespaces are not deleted.

## Verification and release boundary

Independent code review found no blocking defects. Backend typecheck/full tests,
frontend lint/format/typecheck/full tests/build and Wrangler dry-run passed.
Additional focused polling tests cover StrictMode replay, visibility, slow
requests and cleanup; the test-file typecheck also passed. Existing lint and
large-vendor-chunk advisories remain. Actual RaidView was visually checked with
mock rooms and compiled project CSS at desktop and mobile sizes, using a temporary
local harness without credentials or production API calls.

No production deployment or remote push was performed by this change. Production
quota usage is not expected to change until release. Post-release monitoring must
verify the new binding and reduction in RATE_LIMIT_KV writes.

## Primary references

- [KV metrics](https://dash.cloudflare.com/2f3c4cf05dd016ffe51fcf7d262cb501/workers/kv/namespaces/0e8f22caff7a40f596a9bcded20f2f6f/metrics)
- [Worker observability](https://dash.cloudflare.com/2f3c4cf05dd016ffe51fcf7d262cb501/workers/services/view/typing-rpg-backend/production/observability)
- [Native rate limiting and locality](https://developers.cloudflare.com/workers/runtime-apis/bindings/rate-limit/)
- [KV pricing and quota reset](https://developers.cloudflare.com/kv/platform/pricing/)
