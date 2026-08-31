# nohumans.directory — MCP Server

Find and vet paid [x402](https://x402.org) API services before an agent spends money on them.

A discovery and trust layer for paid x402 services. We verify listings two
ways: by paying them real USDC and recording whether they deliver, and by
continuously re-probing every listing's live 402 challenge — several times
an hour, with the full history kept. Each listing carries a recency-weighted
reliability score built from that history, plus on-chain payment evidence
from our own index of the chain — so an agent can check whether an endpoint
actually delivers *before* paying for it.

Free. No API key. No signup. No account.

**Live stats:** https://nohumans.directory/stats · **REST API:** https://api.nohumans.directory

---

## Why this exists

Most x402 directories are catalogs: they list what exists. None of them tell
you whether a listing still works — let alone whether anyone actually pays
it, or whether it delivers when paid.

This one buys from listings and publishes what came back, per call, with the
transaction hash. It probes every endpoint continuously and keeps the
history: a listing moves `unverified → verified` only after sustained clean
probes, and falls to `failing` when it stops responding. The reliability
score is recency-weighted, so a service that broke yesterday can't hide
behind a good month. And every listing shows its on-chain payment activity —
payments, distinct paying wallets, dollars, per day — from our own index of
USDC transfers on Base.

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
https://api.nohumans.directory/mcp


Transport: `streamable-http` · Authentication: none · Cost: free

## Agent Skill

For agents that support the [Agent Skills](https://agentskills.io) standard
(Claude Code, Codex, and others), install the skill so the agent knows how
to use the tools below intelligently — when to prefer `verified` listings,
how to read `score`/`status`/`x402_version`/on-chain payment evidence, and
how to report a real outcome via `tx_hash`:

```bash
mkdir -p ~/.claude/skills/nohumans-directory
curl -o ~/.claude/skills/nohumans-directory/SKILL.md \
  https://raw.githubusercontent.com/jalcodev/nohumans-mcp/main/skills/nohumans-directory/SKILL.md
```

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
| `min_score` | number | Minimum reliability score, `0`-`1` |
| `limit` | number | Max results, 1-50 (default 10) |

### `get_service_details`

Full record for a single service: pricing, accepted chains, request and response
schemas, current status, reliability score, median latency, probe count, protocol
version (`x402_version`), and on-chain payment evidence — 30-day totals, a
per-day series (`onchain_daily`), how many listings share the payment address,
and the sampled payment shape (x402-signed vs plain transfers vs other) —
everything an agent needs before making a paid call.

| Parameter | Type | Description |
|---|---|---|
| `id` | string | Listing ID, as returned by `find_paid_service` |

### `resolve_endpoint`

The reverse lookup: you already hold an endpoint URL — from another catalog, a
prompt, a config file — and want this directory's verdict on it before paying.
Returns the same full record as `get_service_details` when the URL is listed,
a `delisted` warning if it was listed and later removed, or an explicit
not-listed result. Not-listed means never checked here, not unsafe.

| Parameter | Type | Description |
|---|---|---|
| `url` | string | The endpoint URL exactly as held, query string included |

## Example

An agent that needs FX rates and won't pay more than half a cent, and refuses to
touch anything with a reliability score under 0.9:
