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
- **MCP-native** — connect Claude Code / Claude Desktop directly; 17 tools out of the box.
- **HA by design** — Raft consensus (openraft), leader forwarding, and multi-shard horizontal write
  scaling.
- **Secure by default** — refuses to serve unauthenticated on a non-loopback interface; hashed API
  keys; per-vendor webhook signatures; SSRF guard.

Continue with [Getting Started](./getting-started) or the [Architecture](./architecture) overview.
