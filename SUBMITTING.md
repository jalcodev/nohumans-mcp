# Submitting to nohumans.directory

Self-serve, no account, no API key. One `POST` and you're in the probe queue.

The rules below are ordered by how often each one actually causes a problem.
The first is responsible for most failed listings.

---

## 1. Your `endpoint_url` must return HTTP 402 to an unpaid GET

This is the whole verification model. Every 15 minutes we send a plain,
unauthenticated `GET` to your `endpoint_url` and send no payment. A live x402
endpoint answers with `402` and its payment requirements — that single response
proves the service is up *and* protocol-conformant.

**Test before you submit:**

```bash
curl -s -o /dev/null -w '%{http_code}\n' 'YOUR_ENDPOINT_URL'
```

You want `402`. Common results and what they mean:

| Code | Meaning | Fix |
|---|---|---|
| `402` | Correct. | — |
| `400` | Route requires query params before it checks payment. | Include the params in the URL, or return 402 before validating input. |
| `404` | Wrong path, or nothing deployed there. | Point at a real route, not the bare domain. |
| `405` | Route is POST-only. | Submit a GET-able paid route instead. |
| `200` | Returning data without payment. | Point at a route that's actually gated. |
| timeout | Slow or unreachable. | Probes time out at 5s. |

Two traps worth calling out, because both have caught real submissions:

**Don't point at your bare domain** unless the root itself returns 402. Many
services 404 or serve a landing page there.

**Don't point at a POST-only route.** If your paid action is `POST /actions/run`,
submit a GET-able route from the same service (a discovery or quote endpoint that
also returns 402) and describe the POST action in your description.

If your framework validates query parameters *before* checking payment, a bare
probe hit gets `400` instead of `402`. Returning the payment challenge first is
both more spec-correct and what lets crawlers and registries recognise you at all.

---

## 2. `endpoint_url` can never be changed

It's immutable by design — otherwise a listing could earn reputation on one
service and silently be repointed at another. Choose carefully.

Everything else (name, description, price, chains, schemas) can be updated later
with your claim token. If you must change the URL, delist and resubmit — the new
listing starts its probe history from zero.

---

## 3. Save your `claim_token`

The submission response includes a `claim_token`. It is shown **once** and never
again. It's your edit key for `PATCH /v1/listings/:id`.

Lose it and you cannot update your own listing.

---

## 4. Write the description for an agent, not for a landing page

Descriptions are what free-text search matches against, and in practice almost
all discovery queries are free-text rather than category-filtered. A vague
description means agents looking for exactly what you sell won't find you.

**Useful:**

> US equity fundamentals: income, balance sheet and cash-flow statements, live
> ratios and market cap, quarterly earnings, SEC filings, 13F holdings, insider
> trades. Accepts ticker or CIK. US stocks only — no crypto, options, FX, or
> international equities. $0.02 per call.

**Not useful:**

> The most powerful financial data platform for the agentic economy.

Concretely: name the actual data or action, name the coverage limits, name the
units. Limits help more than they hurt — "US stocks only" stops agents wasting a
paid call discovering you don't have what they need.

---

## 5. `sample_query` must differ from `endpoint_url`

Optional. If you offer a free preview that returns `200` without payment, put it
here — it lets agents verify your response shape before spending anything.

If you don't offer one, omit the field. It cannot be identical to
`endpoint_url`; submissions that repeat the same URL are rejected.

---

## 6. Reuse an existing category

Category filtering is exact-match, so an invented spelling is invisible to anyone
filtering on the conventional one. Check what already exists:

```bash
curl -s https://api.nohumans.directory/v1/categories
```

Convention is `namespace.thing`, lowercase, dot-separated —
`data.stocks`, `infra.trust`, `commerce.giftcards`, `action.carbon-retirement`.
Reuse where one fits; invent sparingly, and keep the two-part shape.

---

## Submitting

```bash
curl -X POST https://api.nohumans.directory/v1/listings \
  -H 'content-type: application/json' -d '{
    "name": "Your service",
    "description": "What it returns, what it covers, what it costs.",
    "endpoint_url": "https://api.example.com/v1/thing",
    "category": "data.example",
    "price_amount": 0.001,
    "price_currency": "USDC",
    "chains": ["base"],
    "sample_query": "https://api.example.com/v1/thing?preview=true",
    "submitter_email": "you@example.com"
  }'
```

Required: `name`, `description`, `endpoint_url`, `category`, `price_amount`.
`endpoint_url` must be HTTPS and must not resolve to a private or loopback
address.

Response:

```json
{
  "id": "46719857-b1d",
  "claim_token": "…",
  "status": "unverified",
  "note": "Will be probed within 15 minutes."
}
```

---

## What happens next

Your listing enters at `unverified` and is probed every 15 minutes.

Reputation is a recency-weighted rolling score: each probe moves the score 10%
toward its result, so recent behaviour dominates and a service that broke
yesterday can't hide behind a good month.

**To reach `verified`** a listing needs at least 3 probes, no current failure
streak, and a score above 0.8. Because the score climbs 10% per probe from a
starting point of zero, that means roughly sixteen consecutive clean probes —
about four hours, not four minutes. This is deliberate: the badge should cost
something.

**Five consecutive failures** drop a listing to `failing`.

**Recovery returns a listing to `unverified`, not straight to `verified`.** One
good probe after a failure streak proves liveness, not reliability — so the
listing re-earns `verified` through the normal path. The badge never outruns the
score.

**Thirty days in `failing`** auto-delists the listing. Fix the endpoint and it
recovers on the next passing probe; there's no penalty for having been down.

Check status any time:

```bash
curl -s https://api.nohumans.directory/v1/listings/YOUR_ID
```

## Updating a listing

```bash
curl -X PATCH https://api.nohumans.directory/v1/listings/YOUR_ID \
  -H 'x-claim-token: YOUR_CLAIM_TOKEN' \
  -H 'content-type: application/json' \
  -d '{"price_amount": 0.002, "chains": ["base","solana"]}'
```

## Claiming a listing someone else submitted

Services are sometimes indexed on an operator's behalf. If you own a listing you
didn't submit, you can claim it — see `POST /v1/listings/:id/claim`.

---

## Ranking

Ranking is earned by probe history and cannot be bought. There is no paid
placement, and there won't be — the moment ranking is purchasable, agents route
around the directory and the whole thing is worthless.

Verified listings rank above unverified, then by reliability score, then by
price.

---

Questions: hello@nohumans.directory
