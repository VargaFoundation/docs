---
id: configuration
title: Configuration
sidebar_position: 6
---

# Configuration

Ecphoria loads configuration from three sources, in order of precedence:

1. **Built-in defaults** — sensible defaults for local development.
2. **`ecphoria.toml`** — a file in the working directory.
3. **Environment variables** — prefixed with `ECPHORIA_`, nested keys separated with `__`.

For example `storage.data_dir` is `ECPHORIA_STORAGE__DATA_DIR`, and
`embedding.provider` is `ECPHORIA_EMBEDDING__PROVIDER`.

## Server / gateway

| Setting | Env Var | Default | Description |
|---------|---------|---------|-------------|
| `gateway.listen` | `ECPHORIA_GATEWAY__LISTEN` | `0.0.0.0:8432` | HTTP listen address |
| `gateway.pg_listen` | `ECPHORIA_GATEWAY__PG_LISTEN` | `0.0.0.0:5432` | PostgreSQL wire listen address |
| `gateway.grpc_listen` | `ECPHORIA_GATEWAY__GRPC_LISTEN` | `0.0.0.0:9432` | gRPC listen address |
| `gateway.auth_enabled` | `ECPHORIA_GATEWAY__AUTH_ENABLED` | `false` | Enable API-key/JWT/OIDC authentication |
| `gateway.api_keys` | `ECPHORIA_GATEWAY__API_KEYS` | | Keys, form `<secret>@<tenant>:<role>` (secret may be `sha256:<hex>`) |
| `gateway.mcp_enabled` | `ECPHORIA_GATEWAY__MCP_ENABLED` | `true` | Serve the MCP endpoint at `/mcp` |
| `gateway.llm_proxy_enabled` | `ECPHORIA_GATEWAY__LLM_PROXY_ENABLED` | `false` | Serve the OpenAI/Anthropic-compatible proxy at `/v1/*` |
| `gateway.cdc_sink_url` | `ECPHORIA_GATEWAY__CDC_SINK_URL` | | Outbound CDC: POST every memory change as JSON |

## Storage

| Setting | Env Var | Default | Description |
|---------|---------|---------|-------------|
| `storage.data_dir` | `ECPHORIA_STORAGE__DATA_DIR` | `./data` | Local data directory |
| `storage.engine` | `ECPHORIA_STORAGE__ENGINE` | `local` | `local` or `s3` |
| `storage.s3.bucket` | `ECPHORIA_STORAGE__S3__BUCKET` | `ecphoria` | S3 bucket (MinIO-compatible) |

## Embedding

| Setting | Env Var | Default | Description |
|---------|---------|---------|-------------|
| `embedding.provider` | `ECPHORIA_EMBEDDING__PROVIDER` | `none` | `none`, `ollama` or `openai`. **`none` means BM25-only retrieval** — set this to enable vector recall |
| `embedding.model` | `ECPHORIA_EMBEDDING__MODEL` | `nomic-embed-text` | Model name |
| `embedding.dimension` | `ECPHORIA_EMBEDDING__DIMENSION` | `768` | Vector dimension — must match the model (nomic 768, bge-m3 1024) |
| `embedding.batch_size` | `ECPHORIA_EMBEDDING__BATCH_SIZE` | `64` | Texts per provider call on the bulk paths |
| `embedding.ollama_url` | `ECPHORIA_EMBEDDING__OLLAMA_URL` | `http://localhost:11434` | Ollama server URL |

An in-process ONNX embedding backend is available behind the `embed-local` build feature (no external
service). A local cross-encoder reranker is behind `rerank-local`.

## Memory — cognition

The deterministic core (subject-based contradiction resolution, dedup, importance) is always on.
LLM fact extraction and graph auto-population are opt-in.

| Setting | Env Var | Default | Description |
|---------|---------|---------|-------------|
| `memory.cognition.retrieval_vector_weight` | `ECPHORIA_MEMORY__COGNITION__RETRIEVAL_VECTOR_WEIGHT` | `1.0` | Weight of the vector arm in the fusion. **Set to `0.5` for a large corpus** — see [Knowledge base](./knowledge-base) |
| `memory.cognition.retrieval_lexical_weight` | `ECPHORIA_MEMORY__COGNITION__RETRIEVAL_LEXICAL_WEIGHT` | `1.0` | Weight of the BM25 arm |
| `memory.cognition.retrieval_scan_cap` | `ECPHORIA_MEMORY__COGNITION__RETRIEVAL_SCAN_CAP` | `2048` | Ranked candidates carried forward per query. **Not** a cap on how much of the corpus is searched — the lexical arm uses an inverted index over the whole scope |
| `memory.cognition.graph_expansion` | `ECPHORIA_MEMORY__COGNITION__GRAPH_EXPANSION` | `false` | Query-time knowledge-graph expansion |
| `memory.cognition.extraction` | `ECPHORIA_MEMORY__COGNITION__EXTRACTION` | `none` | `remember` fact extraction: `none` or `llm` |
| `memory.cognition.dedup_threshold` | `ECPHORIA_MEMORY__COGNITION__DEDUP_THRESHOLD` | `0.92` | Cosine similarity at/above which a new memory merges into an existing one |
| `memory.cognition.decay_half_life_days` | `ECPHORIA_MEMORY__COGNITION__DECAY_HALF_LIFE_DAYS` | `30` | Half-life for importance decay, measured from when a memory was last touched |
| `memory.cognition.decay_interval_secs` | `ECPHORIA_MEMORY__COGNITION__DECAY_INTERVAL_SECS` | `0` | Background forgetting interval (`0` = off) |

## Memory — promotion (webhooks → memories)

Webhook deliveries land in episodic memory, which is SQL-queryable but invisible to
`search_memory`. Promotion additionally writes the events that mark a **durable outcome** — merged
pull requests, closed issues, resolved incidents — as memories, so they are recallable alongside
documentation. Off by default: it changes what a corpus contains.

| Setting | Env Var | Default | Description |
|---------|---------|---------|-------------|
| `memory.promotion.enabled` | `ECPHORIA_MEMORY__PROMOTION__ENABLED` | `false` | Write matching webhook events as memories too |
| `memory.promotion.rules` | `ECPHORIA_MEMORY__PROMOTION__RULES` | closes/merges/resolutions | `"<vendor>:<event_type>"`; `*` allowed on either side, and a trailing `*` on the type matches by prefix |

## Cluster

| Setting | Env Var | Default | Description |
|---------|---------|---------|-------------|
| `cluster.enabled` | `ECPHORIA_CLUSTER__ENABLED` | `false` | Enable Raft cluster mode |
| `cluster.node_id` | `ECPHORIA_CLUSTER__NODE_ID` | `1` | This node's Raft ID |
| `cluster.peers` | `ECPHORIA_CLUSTER__PEERS` | | Full voter membership, `id@addr,...` |
| `cluster.shards` | `ECPHORIA_CLUSTER__SHARDS` | `1` | Number of independent Raft groups (write shards) |

## Secrets

Any secret setting also supports the `_FILE` convention — point `ECPHORIA_CLUSTER__SECRET_FILE` at a
mounted file instead of passing the value inline, for Docker/Kubernetes secrets.

## Distributed tracing (OTLP)

Metrics ship to Prometheus at `/metrics` out of the box. To export **traces**, build with the `otlp`
feature and set `ECPHORIA_OTLP_ENDPOINT` to your OTLP/HTTP collector (e.g.
`http://otel-collector:4318/v1/traces`).
