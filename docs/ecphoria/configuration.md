---
id: configuration
title: Configuration
sidebar_position: 4
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
| `gateway.mcp_enabled` | `ECPHORIA_GATEWAY__MCP_ENABLED` | `true` | Enable the MCP server |
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
| `embedding.provider` | `ECPHORIA_EMBEDDING__PROVIDER` | `ollama` | `ollama` or `openai` |
| `embedding.model` | `ECPHORIA_EMBEDDING__MODEL` | `nomic-embed-text` | Model name |
| `embedding.dimension` | `ECPHORIA_EMBEDDING__DIMENSION` | `768` | Vector dimension |
| `embedding.ollama_url` | `ECPHORIA_EMBEDDING__OLLAMA_URL` | `http://localhost:11434` | Ollama server URL |

An in-process ONNX embedding backend is available behind the `embed-local` build feature (no external
service). A local cross-encoder reranker is behind `rerank-local`.

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
