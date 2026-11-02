# Submitting to nohumans.directory

No account, no API key. The current rules, prices and answers live on the site and are
kept up to date there:

- **List it, step by step in a browser:** https://nohumans.directory/submit
- **What it costs, what you get, paid verification:** https://nohumans.directory/sellers
- **Seller questions** (cost, verification time, failed purchases, payment address
  changes, editing, disputes): https://nohumans.directory/sellers/faq
- **The exact API**, for a coding agent: https://api.nohumans.directory/llms.txt and
  https://api.nohumans.directory/v1/sellers

This page keeps the advice that does not change.

## 1. Check your endpoint first, free

```bash
curl -s "https://api.nohumans.directory/v1/check?url=https://api.example.com/v1/thing"
```

One live check with the same unpaid requests our prober makes: whether it would verify,
the payment terms we read from your 402, whether the listing fee is due. Nothing is
created or charged. POST the whole listing body to the same route to validate it too.

## 2. Your endpoint must answer an unpaid request with HTTP 402

That is the verification model: a live x402 endpoint answers an unpaid GET or POST with
402 and its payment requirements. Common answers and fixes:

| Answer | Meaning | Fix |
|---|---|---|
| `402` | Correct. | — |
| `400` / `422` | The route checks its inputs before asking for payment. | Return the 402 first, or list a URL that includes working parameters. |
| `404` | Wrong path, or nothing deployed. | Point at a real paid route, not the bare domain. |
| `200` | Data returned without payment. | Point at a route that is actually gated. |
| `3xx` | A redirect. Probes do not follow redirects. | Submit the final URL. |

## 3. Write the description for an agent, not a landing page

Search matches the description, and almost every search is free text. Name the actual
data or action, the coverage limits and the units.

> US equity fundamentals: income, balance sheet and cash-flow statements, ratios,
> quarterly earnings, SEC filings. Ticker or CIK. US stocks only: no crypto, options,
> FX or international equities.

Limits help: "US stocks only" stops agents wasting a paid call.

## 4. Declare what a valid request looks like

Give `request_schema` with an `example`, `const` or `default` for every required input,
and a free `sample_query` if you have a preview route (it must differ from
`endpoint_url`). A leading reason paid calls fail is a buyer that cannot tell what the
route needs.

## 5. Reuse an existing category

Category filters are exact. Check what exists before inventing one:

```bash
curl -s https://api.nohumans.directory/v1/categories
```

Convention: `namespace.thing`, lowercase, e.g. `data.stocks`, `infra.trust`.

## 6. Save your claim token

The listing response includes a `claim_token`, shown once. It is your key for
`PATCH /v1/listings/:id` (header `x-claim-token`) and for buying paid verification of
your own listing.

## Ranking

Order is earned by probes and purchases and cannot be bought. No fee, plan or licence
changes a listing's status, score or place in results.

Questions: hello@nohumans.directory
