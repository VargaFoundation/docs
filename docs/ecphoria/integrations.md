---
id: integrations
title: Editor & agent integrations
sidebar_position: 3
---

# Editor & agent integrations

Ecphoria exposes a **Model Context Protocol** server over Streamable HTTP at `/mcp`, so any MCP
client can use it — Claude Code, OpenCode, Claude Desktop, Cursor, or your own. One server, 25
tools, shared by every client you point at it: what one agent learns, the others can recall.

Everything below assumes a server on `http://localhost:8432`. If you enabled authentication
(`gateway.auth_enabled`), every example needs an `Authorization: Bearer <key>` header — each section
shows where it goes.

## Claude Code

```bash
claude mcp add --transport http --scope user ecphoria http://localhost:8432/mcp
```

With authentication:

```bash
claude mcp add --transport http --scope user ecphoria http://localhost:8432/mcp \
  --header "Authorization: Bearer $ECPHORIA_API_KEY"
```

The `--transport http` flag is required. Ecphoria serves MCP over HTTP, not stdio, and the CLI
defaults to stdio — omitting the flag is the one thing that reliably goes wrong.

Verify:

```bash
claude mcp list      # ecphoria should appear as connected
```

Then just ask, in any session: *"what do we know about the shard router?"*, or
*"remember that the deploy target is now the EKS cluster"*.

### Automatic session capture (optional)

The Ecphoria repository ships a one-command setup that also installs a `SessionEnd` hook, so each
working session is journalled and can be replayed later:

```bash
./ops/daily/setup.sh --dry-run   # show every change first
./ops/daily/setup.sh
```

It merges into `~/.claude/settings.json` rather than overwriting it, and is safe to re-run. See
`ops/daily/README.md` in the repository for what it keeps (your prompts, the assistant's prose) and
what it deliberately drops (tool calls, diffs, subagent chatter — on a real session that filtering
takes a 3.9 MB transcript down to 25 KB).

## OpenCode

Add an `mcp` block to `opencode.json` — globally at `~/.config/opencode/opencode.json`, or in your
project root to scope it to one repository (the project file wins):

```json
{
  "$schema": "https://opencode.ai/config.json",
  "mcp": {
    "ecphoria": {
      "type": "remote",
      "url": "http://localhost:8432/mcp",
      "enabled": true
    }
  }
}
```

With authentication, add a `headers` object:

```json
{
  "$schema": "https://opencode.ai/config.json",
  "mcp": {
    "ecphoria": {
      "type": "remote",
      "url": "http://localhost:8432/mcp",
      "enabled": true,
      "headers": {
        "Authorization": "Bearer sk-your-key-here"
      },
      "timeout": 10000
    }
  }
}
```

`"type": "remote"` is the important part — `"local"` is for stdio servers launched as a subprocess,
which is not how Ecphoria is served. OpenCode does not expand `${workspaceFolder}` or similar
variables, so any path you write must be absolute.

OpenCode reads project instructions from `AGENTS.md` (its equivalent of `CLAUDE.md`). A line telling
the agent when to reach for memory is worth adding:

```markdown
## Memory

An Ecphoria server holds this project's documentation, ADRs, closed tickets and past incidents.
Search it (`search_memory`) before answering questions about why something is built the way it is,
and record durable decisions with `add_memory` — give a `subject` so a later decision supersedes it
instead of duplicating it.
```

## Claude Desktop

Claude Desktop speaks Streamable HTTP, so point it at the URL directly in its MCP settings:

```json
{
  "mcpServers": {
    "ecphoria": {
      "url": "http://localhost:8432/mcp"
    }
  }
}
```

If your client only supports stdio MCP, bridge it:

```bash
npx -y mcp-remote http://localhost:8432/mcp
```

## Hermes Agent

Hermes' built-in memory is deliberately small (`MEMORY.md` ~2 200 characters, `USER.md` ~1 375) and
it delegates anything larger to a **memory provider plugin**. The Ecphoria repository ships one:

```bash
cp -r examples/hermes-memory-provider ~/.hermes/plugins/ecphoria
pip install httpx
hermes memory setup      # choose "ecphoria"
```

It wires `prefetch` (hybrid search injected into the turn), `sync_turn` (journalling, on a daemon
thread because Hermes requires that hook to be non-blocking), `on_session_end` (distillation), and
three tools including `ecphoria_history` — the one with no equivalent among the other providers,
returning every superseded version of a subject with the period each was believed.

Hermes also has a built-in MCP client, so you can additionally point it at `/mcp` for the full tool
surface. Built-in memory keeps running alongside either integration; providers are additive.

## Any other MCP client

The endpoint is a standard JSON-RPC 2.0 Streamable HTTP server. `initialize` returns an
`Mcp-Session-Id` header; `tools/list` enumerates the surface:

```bash
curl -s -X POST http://localhost:8432/mcp \
  -H 'Content-Type: application/json' \
  -d '{"jsonrpc":"2.0","id":1,"method":"initialize",
       "params":{"protocolVersion":"2025-03-26","capabilities":{},
                 "clientInfo":{"name":"my-client","version":"1.0"}}}'

curl -s -X POST http://localhost:8432/mcp \
  -H 'Content-Type: application/json' \
  -d '{"jsonrpc":"2.0","id":2,"method":"tools/list"}'
```

Implemented methods: `initialize`, `tools/list`, `tools/call`, `resources/list`, `prompts/list`,
`ping`. Note that `resources/read` and `prompts/get` are **not** implemented — resources and prompts
are enumerable but not fetchable, so a client that depends on reading them will not work.

## What the tools give you

| Group | Tools |
|---|---|
| Memory | `add_memory`, `search_memory`, `get_memories`, `memory_history`, `update_memory`, `delete_memory`, `memory_scopes`, `remember` |
| Graph | `link_memory`, `graph_neighbors`, `graph_centrality`, `graph_path`, `graph_communities` |
| Cognition | `memory_provenance`, `memory_feedback`, `list_contradictions` |
| Data | `query` (read-only SQL, including `SELECT … FROM memories`), `ingest`, `search`, `embed` |
| State & sessions | `get_state`, `set_state`, `start_session`, `end_session`, `recall_session` |

Two are worth knowing about specifically:

- **`memory_history`** returns every version of a subject with the period each was believed. "What
  did this runbook say about failover in March" is a question the other memory tools cannot answer.
- **`query`** runs read-only SQL over `memories`, so an agent can answer aggregate questions
  ("which documentation changed most this quarter") rather than only retrieve.

## Tenant isolation

When `gateway.auth_enabled` is on, the tenant comes from the authenticated token and **overrides**
any `tenant_id` a client passes in its arguments. Give each team a tenant-scoped key and they share
one server without seeing each other's memory.

## Troubleshooting

| Symptom | Cause |
|---|---|
| `claude mcp add` succeeds but the server never connects | `--transport http` omitted; the CLI defaulted to stdio |
| Connects, but every search returns nothing | Scope mismatch — memories written with a `user_id` are invisible to a tenant-scoped search. See [Knowledge base](./knowledge-base#scoping) |
| Search finds documents but not by meaning | No embedding provider configured. `embedding.provider` defaults to `none`, which is BM25-only |
| `401` on every call | Auth is enabled and the header is missing or malformed; it must be `Authorization: Bearer <key>` |
| `404` on `/mcp` | `gateway.mcp_enabled = false` |
