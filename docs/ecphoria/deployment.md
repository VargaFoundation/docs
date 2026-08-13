---
id: deployment
title: Deployment
sidebar_position: 7
---

# Deployment

## Docker (standalone)

```bash
docker run -p 8432:8432 -p 5432:5432 -v ecphoria-data:/data \
  ghcr.io/vargafoundation/ecphoria:latest
```

The image runs as a non-root user and stores all state under `/data` (mount a volume to persist it).
A built-in `HEALTHCHECK` hits `/health`.

## Docker Compose (3-node cluster)

The repository ships `deploy/docker-compose.cluster.yml`, which forms a 3-node Raft cluster. Each node
derives its `ECPHORIA_CLUSTER__NODE_ID` and the full `ECPHORIA_CLUSTER__PEERS` membership, and serves
the Raft gRPC transport on `:9433`. The lowest-id node bootstraps the cluster; the rest are pulled in
by the leader.

## Kubernetes (Helm)

```bash
helm install ecphoria deploy/helm/ecphoria \
  --set auth.enabled=true \
  --set persistence.size=50Gi
```

The chart deploys a StatefulSet with:

- Automatic `node_id` derivation from the pod ordinal.
- A headless service for Raft peer DNS.
- A PodDisruptionBudget for safe rolling updates.
- An optional ServiceMonitor for Prometheus scraping.

### Sharded (horizontal write scaling)

Set `sharding.enabled=true` to deploy **N independent Raft groups** (one StatefulSet + headless
service per shard, `replicasPerShard` nodes each). Every node hashes tenants identically, so writes
scale with shard count. A Kubernetes operator (`EcphoriaShardPlan` CRD) reconciles the desired shard
topology.

## Encryption at rest

Ecphoria's stores are files on disk; the recommended at-rest encryption mechanism is **volume/disk
encryption** — LUKS locally, or an encrypted, KMS-backed volume class in the cloud (EBS/PD `gp3`
encrypted). Pair it with `readOnlyRootFilesystem` and an encrypted PVC in Kubernetes.

## Health & observability

```bash
curl http://localhost:8432/health          # liveness
curl http://localhost:8432/ready            # readiness
curl http://localhost:8432/cluster/status   # Raft metrics (cluster mode)
curl http://localhost:8432/metrics          # Prometheus
```

See [Configuration](./configuration) for OTLP trace export.
