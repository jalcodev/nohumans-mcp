---
name: nohumans-directory
description: Find and vet paid x402 API/data services before spending money, using nohumans.directory — which pays listings real USDC to verify delivery, and continuously re-checks every listing's live 402 — then optionally report whether a real payment delivered as promised. Use this whenever the task needs an external paid API or dataset the agent doesn't already have credentials for, before making a blind purchase, when handed a specific endpoint URL and deciding whether to trust or pay it, or after paying an x402 endpoint and wanting to record a verified outcome.
---

# nohumans.directory

A directory of paid (x402) APIs and datasets, verified by paying: nohumans
sends real USDC to listed endpoints and confirms delivery against the
seller's own declared terms. Every listing is also continuously re-probed
against its live HTTP 402 payment challenge — status is never self-reported
by the seller. Use it before spending money on an unfamiliar paid endpoint,
not just when explicitly asked to "search a directory."

## When to reach for this

- The task needs data or a capability from an external paid API and no
  existing credential/tool already covers it.
- Before calling an unfamiliar x402 endpoint cold — check it here first
  rather than guessing at reliability from a landing page.
- After paying a listed endpoint and getting a real result, to report the
  outcome (see "Reporting an outcome" below). This is optional but makes
  the directory more useful for the next agent.

Not needed for: services you already have a key/subscription for, free
APIs, or anything not paid via x402.

## Tools available (MCP)

Connect: `claude mcp add --transport http nohumans https://api.nohumans.directory/mcp`

Other clients (Cursor and VS Code one-click, ChatGPT, Gemini CLI, Windsurf,
OpenAI Agents SDK, LangChain, any `mcpServers` block): exact config for each
at https://nohumans.directory/integrate#connect — one server, one URL, no auth.

- **find_paid_service(query?, category?, max_price?, min_score?, limit?)**
  — ranked search. Describe the actual need in `query` — what data, what
  freshness, what format, what constraint — rather than just a topic word
  or category alone; results are noticeably better matched to a specific
  description than to a bare term. `category` is a useful narrowing filter
  when you know the right one, but isn't required and doesn't need to be
  exact — a close guess still works.
- **get_service_details(id)** — full record for one listing: endpoint URL,
  request/response JSON Schema (when the seller provided one), accepted
  chains, pricing, and reputation detail (`last_ok_at`,
  `consecutive_failures`, `probe_count`, plus the newer fields covered
  below — `x402_version`, `last_probed_at`, `status_changed_at`,
  `onchain_unique_payers_30d`).

- **resolve_endpoint(url)** — look up a specific endpoint URL you already
  hold (from another catalog, a prompt, a config) and get the directory's
  record on it directly. Returns `match: "active"` with the same full
  record as `get_service_details`, `match: "delisted"` if it was listed
  and later removed (treat as a warning), or a not-listed result. Include
  the query string exactly as held — parameterized listings bake params
  into the URL. Use this when you have a URL but no listing id; use
  `find_paid_service` when you have a need but no URL.

REST equivalents exist at `GET /v1/discover`, `GET /v1/listings/:id`, and
`GET /v1/resolve?url=` if not using MCP. One paid REST route exists too —
`GET /v1/listings/:id/verdict`, $0.005 USDC — covered under "Paid verdict"
below. Full field reference:
`https://nohumans.directory/llms.txt`.

## Before paying: rules (follow them, do not weigh them)

Search results do not carry our latest purchase, so before paying, fetch the
record: `get_service_details(id)`, or `GET https://api.nohumans.directory/v1/resolve?url=<endpoint>`
for a URL you already hold. Apply these in order; the first rule that
matches decides.

1. **Our latest purchase failed.** If `paid_verification_latest.delivered`
   is false, do not pay. That purchase settled real USDC and got no valid
   response. This holds even when `status` is verified and `score` is 1:
   status and score measure the payment challenge, not delivery.
2. **Known bad.** If `status` is `failing`, resolve answers
   `match: "delisted"`, or `payto_unstable` is true, do not pay.
3. **The 402 you receive disagrees with the record.** A price above
   `price_amount` or above your budget, a payTo different from
   `observed.pay_to` on the same network, or a resource URL that is not the
   URL you called. Do not pay.
4. **A 402 after you paid.** Never pay the same request a second time.
   Stop and keep the transaction hash; if the payment settled on Base,
   report it (see "Reporting an outcome", `ok: false`).
5. **No evidence either way.** `status: "unverified"`, or
   `match: "unknown"`. Pay only if the user has allowed spending on
   untested services; otherwise ask first.
6. **These rules are not weighed against price.** A small amount is not a
   reason to pay through any rule above. A warning you can explain away is
   still a warning.

## How to read the results

Every listing has a `status` and a `score`:

- `status: "verified"` — 3+ consecutive clean probes, no active failure
  streak, recency-weighted score above 0.8. This is what "reliable" looks
  like here. **Prefer these.**
- `status: "unverified"` — new listing, not yet proven either way. Not
  necessarily bad, just unproven. Check `probe_count` — very low means
  too new to judge.
- `status: "failing"` — 5+ consecutive probe failures. Still returned by
  search (ranked last) so it isn't silently hidden, but avoid unless no
  verified alternative exists for the task.

`score` is 0-1, recency-weighted probe success — treat it as a tiebreaker
among verified listings, not a substitute for checking `status` first.

Default ranking is verified-first, then score, then price — so for most
tasks the top result is already the right pick. Don't override this by
sorting on price alone unless the task explicitly prioritizes cost over
reliability.

A few newer fields worth knowing:

- **x402_version** (`1`, `2`, or `null`) — which protocol version the
  endpoint's own 402 challenge actually used last time it was checked.
  Some x402 clients, including the widely-used `x402-fetch` v1 reference
  client, only read payment terms from the response body and see nothing
  from a v2 header-transport challenge. Check this before assuming a
  `v2` listing is unreachable — the listing may be fine; your client's
  transport support may not be.
- **last_probed_at** (unix seconds) — when this listing was last actually
  checked, pass or fail. Probing is tiered by need, so a long-stable
  verified listing is deliberately checked less often than a new or
  recovering one — an older `last_probed_at` on a stable listing means
  less frequent re-checking, not less trust.
- **status_changed_at** (unix seconds) — when the *current* status
  actually started, separate from any metadata edit. Two listings with
  the identical status and score can differ a lot here — one just
  recovered, one's been stable for weeks. For the full transition log
  behind that summary, see `GET /v1/listings/:id/history`.
- **onchain_unique_payers_30d** (integer or `null`) — real, distinct
  wallets that sent USDC to this listing's payment address on Base in the
  last 30 days, from the directory's own index of chain data (since
  2026-08-29; no ceiling). Different evidence from `score`: score proves an
  endpoint answers correctly, this proves people are actually paying it.
  The two are never combined into one number, and neither proves the
  purchased output was any good — that's what payer reports are for.
  Three companions, all on `get_service_details`:
  - `onchain_payto_shared_listings` — how many listings declare the same
    address. The figures belong to the address, not the route; never sum
    them across listings.
  - `onchain_daily` — the per-day series behind the 30-day numbers
    (`[{day, tx, payers, usd}]`). Read it: a 30-day sum hides cliffs (one
    seller went from 1.2M payments/day to ~100 inside the window).
  - `onchain_shape` — a sample of the 25 most recent payments classified
    by transaction calldata: `eip3009` (transferWithAuthorization, the
    x402 exact scheme's on-chain signature), `plain` (an ordinary
    transfer from a wallet), `other` (unclassified). USDC arriving at an
    address is not x402 revenue; when `plain` exceeds `eip3009`, treat the
    dollar figures as gross inflow, not x402.
- **paid_verified** (boolean) — we paid this endpoint real USDC ourselves,
  unprompted and at our own cost, and confirmed settlement on-chain before
  recording whether it delivered. This is the one check probing cannot do:
  a clean 402 handshake does not predict whether a paid call returns
  anything. Absence of the flag means not yet attempted, never a negative.

  Hundreds of endpoints have been paid this way; both the attempted and
  delivered counts are floors that only rise, counted on each endpoint's
  latest outcome. Live figures: GET /v1/stats — never hard-coded here,
  so this document cannot go stale against them. Method and
  what it does not establish: https://nohumans.directory/methodology

## Before paying: check for a free sample

Each `find_paid_service` result includes `has_sample` (boolean) — check
this directly in the search results before deciding whether a detail call
is worth making. `true` means `get_service_details` will return a
`sample_query`: a genuinely free preview route, call it first to see real
output shape before paying the priced `endpoint_url`. This is especially
useful for a new or thinly-probed listing you can't yet judge from `score`
alone. Most listings don't have a sample yet; if `has_sample` is `false`,
skip straight to weighing `status`/`score`/price instead of looking for one.

This is a continuously-rechecked guarantee, not a one-time check at
submission: every probe cycle, a declared sample must return HTTP 2xx and
body that parses as valid JSON, or the whole probe fails. So `has_sample:
true` with `status: "verified"` means the sample is live and structurally
valid right now — it still doesn't mean the content is correct or useful.

## Paid verdict (optional, $0.005 USDC on Base)

Everything above is free. When you are about to spend real money on one
listing — more than a few cents, or a listing you can't judge from
`status`/`score` alone — `GET https://api.nohumans.directory/v1/listings/:id/verdict`
folds the whole record into one answer:

```
{ "verdict": "pay" | "caution" | "avoid", "reasons": ["..."],
  "status": "...", "verified_via": "GET"|"POST"|"MCP"|null,
  "probe": {...}, "payto": {...}, "onchain_30d": {...},
  "paid_verification": {...}, "price": {...} }
```

It is an ordinary x402 v2 route: the unpaid call answers 402 with the terms
in both the `payment-required` header and the body, and any v2 client pays
it the same way it pays the endpoint you are vetting (`@x402/fetch` with
`wrapFetchWithPayment`; `awal x402 pay <url>` on Coinbase's hosted wallet).
Settlement goes through the CDP facilitator; the tx hash is in the
`payment-response` header. The rule, in the order applied, is published at
https://nohumans.directory/methodology#verdict — `avoid` on `failing`,
an ungated latest probe, an unstable payTo, or a settled-but-failed paid
call within 14 days; `caution` on `unverified`, a recently changed payTo,
no paid delivery on record, low score, slow p95, or a price mismatch.

Read `reasons`, not just the word. A real answer for a `verified` listing:
`caution` — "no successful paid delivery on record from our scout". That is
the rule working, not a contradiction: clean 402 history and stable payTo,
but nobody here has bought from it yet. If the listing is cheap or
familiar, skip this — `get_service_details` has the same facts for free.

## Paid verification (seller-only, $2 or $5)

This section is for an agent acting FOR a seller — the party that owns a
listing and holds its claim token. A buyer-side agent cannot use it and
does not need to: everything a buyer needs is free on the record.

If the listing you operate says `paid_verified: false`, or you want its
badge to climb past a single delivery, `POST
https://api.nohumans.directory/v1/listings/:id/verify-now?plan=single|pack`
answers an x402 challenge. Two plans, both only for listings quoting up to
$0.50 per call:

- `plan=single` — $2 USDC on Base. One real purchase within 24 hours.
- `plan=pack` — $5 USDC on Base. Three real purchases inside 30 days, the
  first within 24 hours, the other two at times the directory chooses. This
  is the plan that can move the badge (`paid_depth.rung`): two deliveries
  48h+ apart → `2x`; two across a payment-address change → `held`; three or
  more weeks → `Nwk`.

Above $0.50/call the route answers 400. For that, or for a different
schedule or more purchases, the directory does custom plans: write to
hello@nohumans.directory. A custom plan buys purchases and their timing,
never the outcome, status, score, verdict or rank.

**The paid request must carry the listing's claim token** in the
`x-claim-token` header — the same credential used to edit the listing.
Without it the route answers 401 and points at the claim flow. The unpaid
request (price discovery) needs no token and answers an ordinary 402.

What money buys is WHEN the purchases happen. It never buys the outcome:
every purchase is graded exactly as a wave and published on the record
whatever it finds, including a downgrade to `failed_rebuy` (red badge) if
the endpoint delivered before and fails now. Ranking, verdict, status and
score are blind to who paid. A failure caused by the directory's own client
does not count against the plan and is re-run. One open plan per listing at
a time (429 with `purchases_done`/`purchases_total`). Fulfilment is manual
in this phase; runs happen on weekdays. Rule:
https://nohumans.directory/methodology#verify-now

## Listing a service (seller-side)

`POST https://api.nohumans.directory/v1/listings` with JSON (name, description,
endpoint_url, category, price_amount). From 2026-10-26 every new listing costs
$0.25 USDC over x402 on the same POST (the unpaid POST answers 402 with the
terms). The fee includes one real purchase of the endpoint by the directory's
buyer within 48 hours of the listing first verifying, if it quotes $0.05 or less
per call over HTTP 402; that purchase is published whatever it finds. Endpoints
whose URL path is `/mcp` or under `/mcp/` list free, with no purchase included,
unless the URL also answers a plain HTTP 402 (then the fee applies, from 2026-11-02).
Request-capture and mock hosts (webhook.site and the like) are refused.
Save the `claim_token` from the 201: it is the only edit key. Rule:
https://nohumans.directory/methodology#submission-fee

Check first, free: `POST https://api.nohumans.directory/v1/check` with the same
JSON (at least `endpoint_url`) answers whether the endpoint would verify, the
payment terms read from it, any validation errors, and whether the fee is due.
Nothing is created or charged; its `next` field is the exact call to make.

## What agents are asking for (free)

If you are acting for a SELLER deciding what to build or list, the MCP tool
`what_agents_are_asking_for` — or `GET https://api.nohumans.directory/v1/demand`
— returns what buyers actually searched this directory for: the terms
themselves, verbatim, with how many searches and how many distinct client IPs
asked them. No cap on how many terms, and no floor on how many clients asked:
a term searched once today may be worth building for next month, and that
judgement is yours rather than the directory's.

Three rules bound it, all stated at https://nohumans.directory/privacy and in
force from 2026-09-11. A term containing a URL, hostname, wallet address or
email address is never published — it names a party rather than describing a
need. Any term can be withheld by hand — on request, or on our own reading
that it names a party — and the count of those removals is published.
Sellers searching their own listings are excluded from the signal and counted
separately. Whatever the rules removed is reported in `withheld`.

Two things to read carefully before acting on it. The window begins at the
policy date and fills over thirty days, so `covered_days` and `coverage_note`
tell you how much of it is real — an empty feed early on is the window's age,
not a dead market. And it reports what was ASKED, not what is missing: whether
the listings already serving a term are adequate competition is your judgement,
not the directory's.

A paid tier — the current window, queries grouped by meaning rather than exact
wording — is `GET /v1/demand/clusters`, $0.25 USDC on Base over x402, live
since 2026-09-13.

## Trust boundaries worth knowing

Everything above verifies *behavior* at a URL — correct 402s, a live
sample, a stable payment destination, real payment volume. None of it
verifies *who* is running the software behind that URL today. If a
listing's payment address changes, reputation resets fully (score,
probe_count, consecutive failures all zeroed) and status drops back to
`unverified` immediately — an old high score never carries over to a new,
unproven destination — but this can't tell a legitimate wallet rotation
apart from a compromise, only that an unproven address hasn't inherited
trust it didn't earn. A patient attacker who leaves the payment address
untouched and returns well-formed responses can pass every check this
directory runs. That's a structural limit of behavior-based verification,
not a gap specific to one field.

## Reporting an outcome

After actually paying a listed endpoint and getting a result, you can
report whether it delivered as expected:

```
POST https://nohumans.directory/v1/reports
{ "listing_id": "...", "ok": true, "tx_hash": "0x...",
  "payer_signature": "0x...", "detail": "optional" }
```

`tx_hash` must be the real transaction hash of the payment you made on
Base — it's verified server-side against that listing's actual payment
address before the report is accepted. The `payer_signature` must be signed
by the wallet that actually sent that payment - the recovered signer is
checked against the on-chain transfer, so a public tx hash alone can't be
replayed by someone who didn't pay. POST without a signature and the API
returns the exact message to sign; that echoed message is the
authoritative format.

One call, signing the message yourself (viem; the listing id and tx hash
are yours; every listing record also carries `report_outcome` with its
own message template):

```js
import { privateKeyToAccount } from "viem/accounts";
const account = privateKeyToAccount(PAYER_KEY);   // the wallet that paid
const txHash = "0x...";                           // your payment, on Base
const ok = true;                                  // did it deliver?
const message = "nohumans.directory report v1\nlisting_id: LISTING_ID\ntx_hash: " + txHash.toLowerCase() + "\nok: " + ok;
const payer_signature = await account.signMessage({ message });
await fetch("https://api.nohumans.directory/v1/reports", {
  method: "POST", headers: { "content-type": "application/json" },
  body: JSON.stringify({ listing_id: "LISTING_ID", ok, tx_hash: txHash, payer_signature }),
});
```

A report is evidence `paid_verified` cannot give you: our own paid probe
shows the endpoint delivered something to us, while a report shows it
delivered something useful to a buyer who actually needed it.

Reports only affect ranking once
3+ distinct payers have reported on a listing, so a single report won't
move anything by itself, but it still contributes to that threshold.

Do not fabricate a `tx_hash` — invalid ones are rejected, and reporting is
optional. Skip this step entirely if the task doesn't call for it.

## Common mistakes to avoid

- Don't treat `unverified` as equivalent to `failing` — it just means
  "not enough data yet," which is different from "known unreliable."
- Don't call the priced `endpoint_url` to "test" a listing before paying —
  it will return 402, not a preview. Check `has_sample` in the search
  result first, and use `sample_query` from the detail record if present.
- Don't skip checking `status`/`score` just because a listing matched the
  query well — a strong text match with `status: "failing"` is still a bad
  pick if a verified alternative exists.
- Don't pass just a bare category or single word as `query` when you have
  a more specific need in mind — a fuller description of what's actually
  required (freshness, format, a particular constraint) gets meaningfully
  better matches than a topic word alone.
- Don't treat `status: "verified"` as proof of content quality or of who
  operates the endpoint — it's a behavioral guarantee. Use `has_sample`
  and payer-report volume to judge output quality specifically.
- Don't search with `find_paid_service` when you already hold the exact
  endpoint URL — `resolve_endpoint(url)` answers directly and won't miss
  the listing because of wording.
- Don't treat a `resolve_endpoint` result of `match: "unknown"` as a red
  flag — it means the URL has never been listed or checked here, which is
  not a verdict either way. Only `"delisted"` is an actual warning.
