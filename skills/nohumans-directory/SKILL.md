---
name: nohumans-directory
description: Find and vet paid x402 API/data services before spending money, using nohumans.directory's probe-verified listings, then optionally report whether a real payment delivered as promised. Use this whenever the task needs an external paid API or dataset the agent doesn't already have credentials for, before making a blind purchase, or after paying an x402 endpoint and wanting to record a verified outcome.
---

# nohumans.directory

A directory of paid (x402) APIs and datasets. Listings are continuously
re-probed against their live HTTP 402 payment challenge — status is never
self-reported by the seller. Use it before spending money on an unfamiliar
paid endpoint, not just when explicitly asked to "search a directory."

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

- **find_paid_service(query?, category?, max_price?, min_score?, limit?)**
  — ranked search. Omit `query` and filter by `category` alone for browsing;
  use `query` for free-text matching against name/description.
- **get_service_details(id)** — full record for one listing: endpoint URL,
  request/response JSON Schema (when the seller provided one), accepted
  chains, pricing, and reputation detail (`last_ok_at`,
  `consecutive_failures`, `probe_count`).

REST equivalents exist at `GET /v1/discover` and `GET /v1/listings/:id` if
not using MCP. Full field reference: `https://nohumans.directory/llms.txt`.

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

`score` is 0–1, recency-weighted probe success — treat it as a tiebreaker
among verified listings, not a substitute for checking `status` first.

Default ranking is verified-first, then score, then price — so for most
tasks the top result is already the right pick. Don't override this by
sorting on price alone unless the task explicitly prioritizes cost over
reliability.

## Before paying: check for a free sample

If `get_service_details` returns a `sample_query` field, that's a genuinely
free preview route — call it first to see real output shape before paying
the priced `endpoint_url`. Most listings don't have one yet; if it's
absent, there's no free preview available, and the request/response JSON
Schema (if present) is the next-best signal of what to expect.

## Reporting an outcome

After actually paying a listed endpoint and getting a result, you can
report whether it delivered as expected:

```
POST https://nohumans.directory/v1/reports
{ "listing_id": "...", "ok": true, "tx_hash": "0x...", "detail": "optional" }
```

`tx_hash` must be the real transaction hash of the payment you made on
Base — it's verified server-side against that listing's actual payment
address before the report is accepted. This is the one signal probing
alone can't provide (a listing can be perfectly live and 402-conformant
and still not deliver a useful result). Reports only affect ranking once
3+ distinct payers have reported on a listing, so a single report won't
move anything by itself, but it still contributes to that threshold.

Do not fabricate a `tx_hash` — invalid ones are rejected, and reporting is
optional. Skip this step entirely if the task doesn't call for it.

## Common mistakes to avoid

- Don't treat `unverified` as equivalent to `failing` — it just means
  "not enough data yet," which is different from "known unreliable."
- Don't call the priced `endpoint_url` to "test" a listing before paying —
  it will return 402, not a preview. Use `sample_query` if present instead.
- Don't skip checking `status`/`score` just because a listing matched the
  query well — a strong text match with `status: "failing"` is still a bad
  pick if a verified alternative exists.
