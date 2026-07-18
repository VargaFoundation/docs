---
id: getting-started
title: Getting Started
sidebar_position: 2
---

# Getting Started

## Run with Docker

```bash
docker run -p 8432:8432 -p 5432:5432 -v ecphoria-data:/data \
  ghcr.io/vargafoundation/ecphoria:latest
```

Ports:

| Port | Protocol | Purpose |
|------|----------|---------|
| 8432 | HTTP | REST API, MCP server, LLM proxy, Prometheus metrics, health checks |
| 5432 | PostgreSQL wire | Query memory with any Postgres client |
| 9432 | gRPC | Typed RPC API |
| 9433 | Raft | Inter-node consensus (cluster mode) |

Check health:

```bash
curl http://localhost:8432/health
# {"status":"ok","version":"0.1.0"}
```

## Build from source

```bash
git clone https://github.com/VargaFoundation/ecphoria
cd ecphoria
cargo build --release
cargo run --bin ecphoria-server
```

The admin CLI binary is `ecphoria`:

```bash
cargo run --bin ecphoria -- status
```

## First memory

Add a memory and search for it over REST:

```bash
curl -X POST http://localhost:8432/api/v1/memories \
  -H 'content-type: application/json' \
  -d '{"content":"Alice prefers window seats","subject":"seating","user_id":"alice"}'

curl -X POST http://localhost:8432/api/v1/memories/search \
  -H 'content-type: application/json' \
  -d '{"query":"where does alice like to sit","k":5,"user_id":"alice"}'
```

Or query episodic memory over the PostgreSQL wire protocol:

```bash
psql "host=localhost port=5432 dbname=ecphoria" -c "SELECT count(*) FROM episodic;"
```

## Connect Claude (MCP)

Ecphoria exposes a Streamable-HTTP MCP server at `/mcp` with 17 tools (memory add/search/history,
graph, state, sessions, SQL, embed). Point Claude Code or Claude Desktop at
`http://localhost:8432/mcp`.

See [Configuration](./configuration) to enable authentication and embeddings.
