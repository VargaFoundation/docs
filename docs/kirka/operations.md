---
id: operations
title: Operations
sidebar_position: 9
---

## Health and readiness

Spring Boot Actuator exposes separate liveness and readiness probes the Helm chart wires
into the Deployment:

- `GET /actuator/health/liveness` — JVM heartbeat. Publicly reachable.
- `GET /actuator/health/readiness` — set after HBase + HDFS connections are up.
- `GET /actuator/prometheus` — Prometheus scrape endpoint.
- `GET /actuator/info` — application metadata.

Admin-only actuator surfaces (`/env`, `/loggers`, `/beans`) require `ROLE_ADMIN`.

## Metrics

Out of the box Kirka publishes:

- `http_server_requests_seconds` — Spring Boot defaults.
- `kirka_hbase_operations_seconds{repository,operation,outcome}` — emitted by
  `RepositoryTimingAspect` for every call in `varga.kirka.repo.*`.
- `kirka_repair_orphans_total` — orphan name-index rows cleaned by the reconciler.
- JVM (memory, GC, threads) via the default Micrometer binders.

A ready-to-import Grafana dashboard and Prometheus rule bundle live in the source tree at
`docs/observability/` — see [Observability](./observability.md) for the full catalogue.

## Logging

Default pattern includes the MDC correlation id:

```
2026-04-24 15:32:10 [http-nio-8080-exec-3] [8f1c-...] INFO  v.k.c.ExperimentController - Creating experiment 'demo'
```

Switch on the `prod` Spring profile (`SPRING_PROFILES_ACTIVE=prod`) for structured JSON
output via `logstash-logback-encoder`. Fields are stable and include `@timestamp`, `level`,
`logger`, `thread`, `request_id`, `message`, `application=kirka`.

Change log levels at runtime via `/actuator/loggers` (admin-only):

```bash
curl -u admin:... -X POST http://kirka:8080/actuator/loggers/varga.kirka \
     -H 'Content-Type: application/json' -d '{"configuredLevel":"DEBUG"}'
```

## Scaling

- **Vertical**: bump the pod requests / limits in `values.yaml` (`resources.limits`).
- **Horizontal**: stateless pods behind `ClusterIP` + HPA. Enable via
  `autoscaling.enabled=true` with CPU target 70% (default chart template).
- **HBase / HDFS**: scale the backends independently; Kirka tolerates partial failures via
  the Ranger plugin's policy cache and the graceful-shutdown hook.

Row-key design already spreads load:

- `mlflow_runs` uses random UUIDs → no hotspotting.
- `mlflow_metric_history` uses `runId + metric + reversedTimestamp` → range scans are cheap
  and newest-first.
- `mlflow_audit` uses `reversedTimestamp + eventId` → same property for the audit trail.

## Reconciliation

`ExperimentIndexReconciler` runs hourly (`@Scheduled(fixedDelay=3600_000)`). It scans the
name-index table and removes entries whose primary row is missing or marked `deleted`. The
number of cleaned rows is exposed as `kirka_repair_orphans_total` — a sustained non-zero
rate is a signal that HBase is experiencing partial-write failures worth investigating.

## Graceful shutdown

Set `server.shutdown=graceful` with a 30-second wait. In Kubernetes the Helm chart adds a
60-second `terminationGracePeriodSeconds` and a `preStop sleep 10` to let service meshes and
load balancers drain before new requests stop landing.

## Upgrades

- **Image**: build and sign with Cosign (keyless OIDC) — the CI workflow does this on each
  merge to `main`. Roll by updating `image.tag` (default: the chart `appVersion`).
- **Schema**: column families and table names are backwards-compatible across patch
  releases; breaking changes are called out in the CHANGELOG.
- **Zero-downtime rollouts**: with `replicaCount: 2` plus `PodDisruptionBudget.minAvailable=1`
  (both default in the Helm chart) a rolling restart never takes the API offline.

## Backup and restore

- **HBase tables**: snapshot with `hbase snapshot_table 'mlflow_*'`, export via
  `ExportSnapshot` to S3/HDFS. Kirka tables hold tens of GB at scale — budget accordingly.
- **HDFS artifacts**: periodic `distcp` to cold storage. Artifact paths are rooted under
  `hadoop.hdfs.uri` + the run's artifact URI — isolate that tree for the backup job.
- **Audit table**: same as the other HBase tables. Because the row key is
  reverse-timestamp-prefixed, incremental exports are trivial (scan up to the row key of
  the last exported event).
