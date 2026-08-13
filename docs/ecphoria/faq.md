---
id: faq
title: FAQ
sidebar_position: 9
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

### How does it connect to my editor?

It exposes a Streamable-HTTP MCP server at `/mcp` with 25 tools, so any MCP client uses it directly
— Claude Code (`claude mcp add --transport http …`), OpenCode (a `"type": "remote"` entry in
`opencode.json`), Claude Desktop, Cursor. One server can back all of them at once, so what one agent
learns the others recall. See [Editor & agent integrations](./integrations).

It also offers an OpenAI/Anthropic-compatible LLM proxy with automatic RAG, off by default
(`gateway.llm_proxy_enabled`).

### Can I use it as a knowledge base for my team's documentation?

Yes — that is a first-class use case rather than a repurposing. `ecphoria import --from git` splits
each Markdown file on its heading hierarchy and stores one memory per section, using the file's last
commit date as valid-time. Re-import after a merge and only the sections that changed are
superseded; the previous text stays queryable, so "what did this runbook say in March" is a query.
Tickets and incidents join the same corpus through the GitHub backfill and webhook promotion. See
[Engineering knowledge base](./knowledge-base).

### Does this replace my CLAUDE.md / AGENTS.md?

No — and the distinction matters. An instruction file is **pushed**: injected into every session,
always present, which is right for build commands, conventions and rules. Ecphoria is **pulled**:
the agent queries it when a question needs it, which is right for knowledge — why a decision was
made, what broke last quarter, which ticket covered this.

What it replaces is the half of the instruction file that *grows and rots*: accumulated history and
project context that someone has to remember to update. Keep the instruction file short and
instructional, and add a paragraph telling the agent the knowledge base exists. See
[Instruction files vs. a knowledge base](./index.md#instruction-files-vs-a-knowledge-base).

### Do I have to use Hermes, or an agent framework at all?

No. The MCP server is the primary interface and works with any client. Hermes has a dedicated
memory-provider plugin because its plugin slot exists; nothing else depends on it.

### How does high availability work?

Raft consensus (openraft). Writes are proposed through the leader and applied deterministically on
every node, so committed data survives a leader failure; a dispatcher auto-resumes in-flight agent
runs after failover. For write throughput, run multiple independent Raft groups (shards).

### What license is it under?

Apache 2.0.
