#!/usr/bin/env node
// nohumans-mcp — stdio bridge to the nohumans.directory MCP server.
//
// Deliberately thin. Tools, schemas and behaviour live on the HTTP server at
// api.nohumans.directory/mcp and are never duplicated here, so this package
// does not need republishing when the tool set changes. No dependencies: Node
// 18+ has fetch. The only thing this adds is a command name, which is what
// MCP registries and marketplaces index.
const ENDPOINT = process.env.NOHUMANS_MCP_URL || "https://api.nohumans.directory/mcp";
const VERSION = "1.0.0";
let sessionId = null;

const out = (obj) => process.stdout.write(JSON.stringify(obj) + "\n");
const rpcError = (id, code, message) => ({ jsonrpc: "2.0", id, error: { code, message } });

async function forward(msg) {
  const headers = {
    "content-type": "application/json",
    "accept": "application/json, text/event-stream",
    "user-agent": `nohumans-mcp/${VERSION} (npm stdio bridge)`,
    // So our own numbers can tell npm/stdio traffic from direct HTTP instead
    // of guessing. Carries nothing about the caller.
    "x-nohumans-client": "npm-stdio",
  };
  if (sessionId) headers["mcp-session-id"] = sessionId;

  const res = await fetch(ENDPOINT, { method: "POST", headers, body: JSON.stringify(msg) });
  const sid = res.headers.get("mcp-session-id");
  if (sid) sessionId = sid;

  if (res.status === 202) return [];            // notification accepted, no body
  const text = await res.text();
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${text.slice(0, 300)}`);

  const ct = res.headers.get("content-type") || "";
  if (ct.includes("text/event-stream")) {
    const msgs = [];
    for (const line of text.split(/\r?\n/)) {
      if (!line.startsWith("data:")) continue;
      const payload = line.slice(5).trim();
      if (!payload || payload === "[DONE]") continue;
      try { msgs.push(JSON.parse(payload)); } catch { /* keep-alive or partial */ }
    }
    return msgs;
  }
  if (!text.trim()) return [];
  return [JSON.parse(text)];
}

async function handle(line) {
  let msg;
  try { msg = JSON.parse(line); }
  catch { return out(rpcError(null, -32700, "Parse error")); }
  try {
    for (const m of await forward(msg)) out(m);
  } catch (e) {
    // A request must get an answer; a notification has nobody to answer to.
    if (msg && msg.id !== undefined && msg.id !== null) {
      out(rpcError(msg.id, -32603, `nohumans-mcp bridge: ${e.message}`));
    } else {
      process.stderr.write(`nohumans-mcp: ${e.message}\n`);
    }
  }
}

// One at a time: JSON-RPC allows out-of-order responses, but keeping the order
// the client sent makes bug reports legible.
let chain = Promise.resolve();
let buf = "";
process.stdin.setEncoding("utf8");
process.stdin.on("data", (chunk) => {
  buf += chunk;
  let i;
  while ((i = buf.indexOf("\n")) >= 0) {
    const line = buf.slice(0, i).trim();
    buf = buf.slice(i + 1);
    if (line) chain = chain.then(() => handle(line));
  }
});
process.stdin.on("end", () => { chain.then(() => process.exit(0)); });
