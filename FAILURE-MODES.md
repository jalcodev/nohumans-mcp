# Failure modes a 402 response cannot rule out

A liveness probe asks one question: does an unpaid request return HTTP 402 with
payment requirements? That proves the endpoint is up and speaks the protocol. It
does **not** prove an agent can actually pay it.

Every case below produces a perfectly well-formed 402. Every one was found in
production, in services that were passing probes and carrying a `verified`
badge. Two were in our own endpoints.

Recorded 2026-07-27.

---

## 1. Facilitator does not support the advertised network

**Symptom:** payment fails at `/verify`. Nothing settles. The 402 is valid.

**Cause:** the endpoint advertises a network its configured facilitator will not
settle on. Most commonly a service developed against a testnet facilitator and
switched to mainnet by changing only the network variable.

**Real case (ours, twice).** Both the FX oracle and GridHub ran
`FACILITATOR_URL = https://x402.org/facilitator` with `NETWORK = base`. That
facilitator's `/supported` list contains only testnets — `eip155:84532`,
`solana-devnet`, `stellar:testnet` and similar. `eip155:8453` is absent. The FX
oracle advertised uncollectable mainnet payments for four days. GridHub, across
eight listings, for longer.

**Detection — free, no payment:**

```
GET {facilitator}/supported
```

Compare each `kinds[].network` against the network in the endpoint's 402. Note
that facilitators may list the same chain under both v1 and v2 naming
(`base` and `eip155:8453`), so compare after normalising.

**Caveat:** the facilitator is usually *not* in the 402 challenge, so this
check needs the operator to declare it, or is only available to self-audit.

---

## 2. EIP-712 domain name does not match the token contract

**Symptom:** facilitator rejects with `invalid_exact_evm_token_name_mismatch`.

**Cause:** the `exact` EVM scheme signs an EIP-712 authorization whose domain
must equal the token contract's on-chain `name()`. Mainnet USDC reports
`"USD Coin"`. The Base Sepolia test token reports `"USDC"`. Code written against
testnet and moved to mainnet keeps the wrong string.

**Real case (ours).** GridHub advertised `extra: { name: "USDC", version: "2" }`
against the mainnet USDC contract. Every payment failed. The value was also
published in `/.well-known/x402.json`, so the wrong domain propagated to every
ecosystem crawler indexing that manifest.

**Detection — free:**

```
extra.name  must equal the on-chain name() of the contract at `asset`
```

For USDC: `"USD Coin"` on mainnets, `"USDC"` on Base Sepolia. This is a
lookup against a known table for common assets, or an `eth_call` to `name()`
for the general case.

---

## 3. Solana payTo has no associated token account

**Symptom:** transaction dies at simulation. Never reaches the chain.

**Cause:** on Solana, if the `payTo` wallet has never held the token, its
associated token account does not exist, and the reference client does not
create one. The facilitator rejects the transaction because the optional
instruction slots only allow Lighthouse and Memo. Nothing about the 402 hints
at this.

**Real case (third party).** Reported by an operator whose own endpoint "sat
listed and discoverable for two days advertising a price it structurally could
not collect" — found only by reading the reference implementation in two
languages.

**Detection — free:** derive the ATA from `payTo` and the mint, then check
whether that account exists. Deterministic, no payment, no cooperation from the
operator needed.

---

## 4. Endpoint and client speak different spec versions

**Symptom:** client crashes or reports no payment requirements. Endpoint is
fine. Not the seller's fault.

**Cause:** x402 v1 returns the challenge in the response **body** with an
`accepts` array. v2 may return it in a `payment-required` **header**, with an
empty body, and renames fields (`maxAmountRequired` → `amount`). A client
implementing one will not see a challenge from the other.

**Real case (ours).** GEF returns a v2 header challenge with `content-length: 2`.
`x402-fetch` — Coinbase's own reference client — reads `accepts` from the body,
finds `undefined`, and throws before signing anything. The endpoint is correctly
configured and currently unpayable by that client.

**Detection — free:** record which version and challenge transport each endpoint
uses. This is a compatibility fact about a pair, not a defect in either side, and
it should be reported as such.

---

## What this implies for verification

All four are structural and detectable without spending anything. None are
visible to a liveness probe. Three of the four were found by reading
configuration rather than responses; the fourth by attempting a payment with a
real client.

An honest verification claim therefore has layers:

| Claim | Cost | What it proves |
|---|---|---|
| responds | free | the host is up |
| returns 402 | free | speaks the protocol |
| **can settle** | **free** | **facilitator supports network; domain name matches; ATA exists** |
| does settle | price per call | the whole path works |
| delivers | price per call | the response is what was advertised |

The third row is the gap. It costs nothing, catches all of cases 1–3, and no
directory currently checks it.

The fifth row cannot be done continuously at any scale — 172 listings probed
every 15 minutes at even $0.001 is roughly $500/month — so it belongs in
sampling, not the main loop.

## Reporting these honestly

A listing failing checks 1–3 is not "down". It is misconfigured, and the
operator almost certainly does not know: every one of these was invisible to
its owner. A directory that surfaces them is doing something more useful than
scoring uptime, but only if it labels them precisely rather than folding them
into a failure rate.

Case 4 is not a defect at all and must not be scored against either party.
