---
id: faq
title: FAQ
sidebar_position: 7
---

# FAQ

### What is Ecphoria in one line?

The memory engine that also runs — and remembers — your agents. A single Rust binary giving AI agents
a durable, HA memory plus the runtime to execute agents on top of it.

### Where does the name come from?

*Ecphory* (coined by Richard Semon) is the reactivation/retrieval of a stored memory trace (an
*engram*) — precisely what a memory system does on its read path.

### How is it different from Mem0 or Zep?

Those keep the "intelligent" part of memory (dedup, contradiction resolution, ranking) behind a cloud
API or a paywalled graph. Ecphoria runs that same intelligence in your own self-hostable binary, on
your own infrastructure, and it's benchmarkable end-to-end.

### Do I need a vector database or an embedding model?

No. Episodic and state storage need nothing external. Hybrid retrieval works with BM25 alone and ranks
well without embeddings; add an embedding provider (Ollama/OpenAI, or the in-process `embed-local`
backend) to enable vector recall.

### Is it really PostgreSQL-compatible?

Yes — Ecphoria speaks the PostgreSQL wire protocol on `:5432`, so any Postgres client or driver can
query the episodic memory with SQL.

### How does it connect to Claude?

It exposes a Streamable-HTTP MCP server at `/mcp` with 17 tools, so Claude Code and Claude Desktop can
use it directly. It also offers an OpenAI-compatible LLM proxy with automatic RAG.

### How does high availability work?

Raft consensus (openraft). Writes are proposed through the leader and applied deterministically on
every node, so committed data survives a leader failure; a dispatcher auto-resumes in-flight agent
runs after failover. For write throughput, run multiple independent Raft groups (shards).

### What license is it under?

Apache 2.0.
