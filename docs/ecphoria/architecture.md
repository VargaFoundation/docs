---
id: architecture
title: Architecture
sidebar_position: 3
---

# Architecture

Ecphoria is three layers stacked in one process (`ecphoria-server`):

```
 ┌────────────────────────────────────────────────────────────────────────────┐
 │  PROTOCOLS  (ecphoria-gateway)                                              │
 │  REST/MCP/LLM-proxy :8432 · PostgreSQL wire :5432 · gRPC :9432             │
 │  auth (API key / JWT / OIDC) · RBAC · rate-limit · audit · multi-tenant    │
 └───────────────┬────────────────────────────────────────────────────────────┘
                 │  every request → EcphoriaEngine (tenant-scoped)
 ┌───────────────▼────────────────────────────────────────────────────────────┐
 │  ENGINE  (ecphoria-core :: EcphoriaEngine)                                 │
 │  AGENT RUNTIME (the "brain")        MEMORY SUBSTRATE (storage + recall)     │
 │  · durable RunStore                 · Episodic  (DuckDB, SQL)               │
 │  · run_agent LLM↔tool loop          · Semantic  (USearch HNSW + embeddings) │
 │  · downstream MCP tool-gateway      · State     (SQLite + DashMap)          │
 │  · HITL approvals                   · Cognition (bi-temporal memories +     │
 │  · DAG workflows + subagents            knowledge graph + hybrid retrieval  │
 │  · RunDispatcher (auto-resume)          + rerank)                           │
 │  · event triggers                                                          │
 └───────────────┬────────────────────────────────────────────────────────────┘
                 │  writes proposed through consensus (cluster mode)
 ┌───────────────▼────────────────────────────────────────────────────────────┐
 │  CLUSTER / HA  (ecphoria-cluster)                                          │
 │  Raft (openraft) · gRPC+MessagePack transport :9433 · leader-forward ·     │
 │  sharding (N Raft groups) · snapshots · k8s operator                       │
 └────────────────────────────────────────────────────────────────────────────┘
```

## Crate layout

| Crate | Responsibility |
|-------|----------------|
| `ecphoria-core` | Core engine: memory stores, query, storage, ingest, embedding, agent runtime. Zero knowledge of protocols or clustering. |
| `ecphoria-gateway` | Protocol layer: PostgreSQL wire, REST, gRPC, MCP, LLM proxy, auth, leader forwarding. |
| `ecphoria-cluster` | Raft consensus (openraft), replication, coordination. |
| `ecphoria-cli` | Admin CLI (binary: `ecphoria`) — talks to the server over HTTP. |
| `ecphoria-server` | The main binary: thin wiring layer. |

**Dependency rule:** dependencies go *down*. Core has zero knowledge of gateway or cluster.

## Storage engines

- **Episodic** — DuckDB (file-backed or in-memory), typed schema, SQL-injection-safe SELECT
  whitelist, per-tenant row isolation.
- **Semantic** — USearch HNSW vector index, cosine similarity, persistent save/load.
- **State** — SQLite (rusqlite) + a DashMap hot cache, CRUD + compare-and-swap.
- **Cognition** — bi-temporal `memories` in DuckDB with deterministic supersession, dedup, importance
  and decay, plus a separate rebuildable vector index and a knowledge-graph edge table.

## Retrieval pipeline

Hybrid retrieval fuses **BM25** (pure Rust, no dependencies) with **vector search** via Reciprocal
Rank Fusion, with configurable candidate widths and optional graph expansion. An optional reranker
(LLM or a local ONNX cross-encoder) refines the read path. It works — and ranks well — even with no
embedding provider configured.

## Consensus

In cluster mode, ingest / state / memory writes are proposed as an `AppRequest` through Raft and
applied deterministically on every node, so committed writes survive leader failover. The leader runs
non-deterministic work (cognition, LLM extraction) **once** and replicates the materialized result, so
`apply` stays a pure function of the request. Horizontal write scaling uses multiple independent Raft
groups (shards) with consistent-hash tenant routing.
