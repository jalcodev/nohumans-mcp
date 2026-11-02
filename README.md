# nohumans.directory — MCP server

Find and vet paid [x402](https://x402.org) APIs and datasets before an agent spends money on them.

nohumans.directory is a registry of pay-per-call APIs that AI agents can buy with USDC.
Every listing is probed for a valid payment request (a live x402 endpoint answers an
unpaid request with HTTP 402), and many listings are bought with real USDC on Base: the
outcome is published with its settlement transaction, including purchases that took the
money and did not deliver. Placement in results is never sold.

All tools are free and read-only. No API key, no account. The directory never moves money:
any payment happens in your own agent, under the seller's terms.

**Website:** https://nohumans.directory · **Live stats:** https://nohumans.directory/stats ·
**API reference for agents:** https://api.nohumans.directory/llms.txt

## Install

The server is remote: Streamable HTTP, no authentication.

```
https://api.nohumans.directory/mcp
```

Claude Code:

```bash
claude mcp add --transport http nohumans https://api.nohumans.directory/mcp
```

Clients that read an `mcpServers` block with remote servers:

```json
{ "mcpServers": { "nohumans": { "type": "http", "url": "https://api.nohumans.directory/mcp" } } }
```

Clients that only run local (stdio) servers: use the [`nohumans-mcp`](https://www.npmjs.com/package/nohumans-mcp)
npm package, a small bridge to the same server (no dependencies, Node 18+):

```json
{ "mcpServers": { "nohumans": { "command": "npx", "args": ["-y", "nohumans-mcp"] } } }
```

The bridge is `index.mjs` in this repository: one file, no dependencies, published to npm as
`nohumans-mcp`. `NOHUMANS_MCP_URL` overrides the endpoint.

Setup lines for Cursor, VS Code, ChatGPT, Gemini CLI, the OpenAI Agents SDK and LangChain:
https://nohumans.directory/integrate#connect

## Tools

| Tool | What it does |
|---|---|
| `find_paid_service` | Search by need: `query` (describe the need specifically), `category`, `max_price`, `min_score` (0..1), `protocol` (`x402` or `mpp`), `mpp_method`, `limit`. Ranked verified first, then probe score, then price. |
| `get_service_details` | One listing's full record by `id`: request shape, observed payment terms, probe history, latest purchase outcome. |
| `resolve_endpoint` | Check an endpoint `url` you already hold: listed, delisted, or never checked here (not the same as unsafe). |
| `what_agents_are_asking_for` | The aggregate demand feed: what agents search this directory for. For sellers deciding what to build or list. |

What the main fields mean (`status`, `score`, `paid_verified`, `latest_purchase_delivered`,
`evidence_tier`) and the rules an agent should follow before paying:
https://nohumans.directory/integrate#rules

## Agent Skill

For agents that support [Agent Skills](https://agentskills.io) (Claude Code and others):

```bash
mkdir -p ~/.claude/skills/nohumans-directory
curl -o ~/.claude/skills/nohumans-directory/SKILL.md \
  https://raw.githubusercontent.com/jalcodev/nohumans-mcp/main/skills/nohumans-directory/SKILL.md
```

## Selling an API

List it at https://nohumans.directory/submit (check it free first). What it costs and what
you get: https://nohumans.directory/sellers. Notes for submitters: [SUBMITTING.md](SUBMITTING.md).

## Method

How listings are probed, bought and scored, with every correction and rule change:
https://nohumans.directory/methodology

## Licence

Contents of this repository: MIT. Directory data: CC BY 4.0, credit "nohumans.directory" with a link.
