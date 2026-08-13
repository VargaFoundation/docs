---
id: index
title: Overview
sidebar_position: 1
---

# Ecphoria

**The open-source agentic memory platform.** Ecphoria is a single Rust binary that gives AI agents a
durable, highly-available memory — and runs the agents on top of it. It is PostgreSQL wire-compatible,
MCP-native, and deployable via Docker or Kubernetes with Raft-based clustering for HA.

> *Ecphory* (Richard Semon) is the reactivation of a stored memory trace — literally what a memory
> system does on its read path.

AI agents lose their memory every time you restart them. Ecphoria fixes that — and unlike a bare
vector DB, it does the *intelligent* part of memory for you. Most agent-memory intelligence (Mem0,
Zep) lives behind a cloud API or a paywalled graph. Ecphoria is the genuinely open, self-hostable,
benchmarkable alternative: the smarts run in your own binary, on your own infrastructure.

## The three layers

1. **Memory substrate** — episodic events (DuckDB), semantic embeddings (USearch HNSW), live
   key-value state (SQLite), and a bi-temporal cognition/graph layer with hybrid retrieval.
2. **Agent runtime** — durable runs, an LLM↔tool driver, human-in-the-loop approvals, DAG workflows,
   event triggers, a downstream MCP tool-gateway, and a dispatcher that auto-resumes runs after
   failover.
3. **Protocols** — PostgreSQL wire, REST, gRPC, MCP, and an LLM proxy.

## Memory intelligence (the hard part)

- **Bi-temporal memories** — every fact has `valid_from`/`valid_to`, so you can ask *"what did we
  believe at time T?"* in plain SQL.
- **Contradiction resolution** — a newer fact about the same subject **supersedes** the old one (kept
  as history), deterministically, no LLM required.
- **Deduplication & consolidation** — near-duplicate facts merge instead of piling up.
- **Hybrid retrieval** — deterministic BM25 fused with vector search via Reciprocal Rank Fusion.
  Works and ranks well even with no embedding provider configured.
- **Decay-based forgetting** — low-value memories fade by time-decayed importance.
- **Knowledge graph** — memories link into a graph with hybrid graph-expanded retrieval.

## Why Ecphoria

- **Single binary** — embedded DuckDB, USearch, and SQLite. No external services required to start.
- **PostgreSQL wire-compatible** — query your agents' memory with any Postgres client.
- **MCP-native** — connect Claude Code / Claude Desktop directly; 25 tools out of the box.
- **HA by design** — Raft consensus (openraft), leader forwarding, and multi-shard horizontal write
  scaling.
- **Secure by default** — refuses to serve unauthenticated on a non-loopback interface; hashed API
  keys; per-vendor webhook signatures; SSRF guard.

## Beyond agent memory: a team knowledge base

The same substrate holds an engineering team's own material — documentation that changes, ADRs,
resolved incidents, closed tickets — and answers questions about it from your editor. Markdown is
split on its heading hierarchy so a document that evolves keeps history *section by section*, and
`ecphoria import --from git` keeps the corpus in step with the repository.

See [Engineering knowledge base](./knowledge-base).

## Instruction files vs. a knowledge base

Instruction files — `CLAUDE.md`, `AGENTS.md`, `.cursorrules` — do two jobs, and only one of them
they do well. Understanding the split is the difference between a working setup and a file nobody
reads.

|  | Instruction file — **pushed** | Ecphoria — **pulled** |
|---|---|---|
| How it reaches the agent | Injected into every session's context, always present | The agent queries it when a question needs it |
| Best for | *Instructions* — build commands, conventions, rules, "always do X" | *Knowledge* — why a decision was made, what broke last quarter, which ticket covered this |
| Cost of growth | Every token is paid on every request, forever | Nothing until asked |
| Staleness | Someone has to remember to edit it | Re-imported from git, tickets and incidents; contradictions supersede automatically |
| Sharing | Copied between repos, drifts | One server, many projects, tenant-scoped |

Ecphoria does **not** replace the instruction file. It replaces the half of it that grows and
rots: accumulated history, past decisions, project context — the part people stop reading because
it is three screens long and half of it is no longer true.

The pattern that works: keep the instruction file short and purely instructional, and add one
paragraph pointing the agent at the knowledge.

```markdown
## Memory

An Ecphoria server holds this project's documentation, ADRs, closed tickets and past incidents.
Search it (`search_memory`) before answering *why* something is built the way it is, and record
durable decisions with `add_memory` — give a `subject` so a later decision supersedes it rather
than duplicating it.
```

Same paragraph works in `AGENTS.md` for OpenCode, or any other agent's instruction file.

## Next

- [Getting Started](./getting-started) — run it, add a memory, search it
- [Editor & agent integrations](./integrations) — Claude Code, OpenCode, Claude Desktop, Hermes
- [Engineering knowledge base](./knowledge-base) — docs, ADRs, incidents and tickets
- [Architecture](./architecture) — how the three layers fit together
