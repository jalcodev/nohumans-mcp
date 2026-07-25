# nohumans.directory — MCP Server

Find and vet paid [x402](https://x402.org) API services before an agent spends money on them.

A discovery and trust layer for paid x402 services. Every listing is re-probed
every 15 minutes, and each carries a recency-weighted reliability score built
from that probe history — so an agent can check whether an endpoint actually
responds *before* paying for it.

Free. No API key. No signup. No account.

**Live stats:** https://nohumans.directory · **REST API:** https://api.nohumans.directory

---

## Why this exists

Most x402 directories are catalogs: they list what exists. None of them tell you
whether a listing still works.

This one probes every endpoint it lists, every 15 minutes, and keeps the history.
A listing moves `unverified → verified` only after sustained clean probes, and
falls to `failing` when it stops responding. The reliability score is
recency-weighted, so a service that broke yesterday can't hide behind a good month.

Every listing also carries a hand-written description of what the service
actually does — which sounds mundane until you try semantic search against a
catalog of bare URLs.

## Installation

Remote server, streamable HTTP. No install, no build step, no credentials.

### Claude Code

```bash
claude mcp add --transport http nohumans https://api.nohumans.directory/mcp
```

### Claude Desktop / any stdio-only client

```json
{
  "mcpServers": {
    "nohumans": {
      "command": "npx",
      "args": ["mcp-remote", "https://api.nohumans.directory/mcp"]
    }
  }
}
```

### Direct remote connection

```
https://api.nohumans.directory/mcp
```

Transport: `streamable-http` · Authentication: none · Cost: free

## Tools

### `find_paid_service`

Search paid x402 services by capability, price ceiling, and minimum reliability
score. Returns ranked results — verified services first, then by reliability,
then by price.

| Parameter | Type | Description |
|---|---|---|
| `query` | string | Free-text search across service names and descriptions |
| `category` | string | Exact category filter, e.g. `data.fx`, `infra.trust` |
| `max_price` | number | Maximum price per call, in USDC |
| `min_score` | number | Minimum reliability score, `0`–`1` |
| `limit` | number | Max results, 1–50 (default 10) |

### `get_service_details`

Full record for a single service: pricing, accepted chains, request and response
schemas, current status, reliability score, median latency, and probe count —
everything an agent needs before making a paid call.

| Parameter | Type | Description |
|---|---|---|
| `id` | string | Listing ID, as returned by `find_paid_service` |

## Example

An agent that needs FX rates and won't pay more than half a cent, and refuses to
touch anything with a reliability score under 0.9:

```
find_paid_service(query="fx rates", max_price=0.005, min_score=0.9)
```

Returns matching services with their live reliability scores and median latency,
so the agent can pick one and pay with confidence.

## REST API

The same data is available over plain HTTP, no MCP client required:

```bash
# Search
curl 'https://api.nohumans.directory/v1/discover?q=fx&max_price=0.005&min_score=0.9'

# Full detail for one listing
curl 'https://api.nohumans.directory/v1/listings/{id}'

# Live directory stats
curl 'https://api.nohumans.directory/v1/stats'

# What agents search for and can't find
curl 'https://api.nohumans.directory/v1/demand'
```

Agent-readable docs: [`/llms.txt`](https://api.nohumans.directory/llms.txt)

## Listing a service

Self-serve, no account:

```bash
curl -X POST https://api.nohumans.directory/v1/listings \
  -H 'content-type: application/json' -d '{
    "name": "Your service",
    "description": "What it does, in a sentence an agent can act on.",
    "endpoint_url": "https://api.example.com/v1/thing",
    "category": "data.example",
    "price_amount": 0.001,
    "price_currency": "USDC",
    "chains": ["base"]
  }'
```

Submissions land as `unverified` and are probed within 15 minutes. Sustained
clean probes promote a listing to `verified`; sustained failures demote it.
Ranking is earned by uptime, never sold.

Save the `claim_token` from the response — it's your edit key, shown once.

Full submission guide, including the HTTP 402 requirement that causes most
rejected listings: [SUBMITTING.md](SUBMITTING.md)

## How verification works

- Every listing is probed every 15 minutes from independent infrastructure.
- A live x402 endpoint answers an unpaid request with HTTP `402` and payment
  requirements — that alone proves liveness and protocol conformance. Probes
  never send payment.
- Reliability scores are recency-weighted: recent behaviour dominates.
- Status lifecycle: `unverified → verified → failing → delisted`.
- Probes originate from our infrastructure, not from sellers. Reliability
  cannot be self-reported.

## License

MIT for this documentation. The directory service itself is free to use.

## Contact

hello@nohumans.directory
