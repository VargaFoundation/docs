---
id: index
title: Kirka — MLflow-compatible service for Hadoop
sidebar_position: 1
---

Kirka is an MLflow-compatible tracking server optimised for the Hadoop ecosystem. It uses
HDFS for artifact storage and HBase for experiments, runs, parameters, metrics, models, and
audit trail — no external SQL database required.

## Why Kirka

- **Runs where your data lives.** Deploy inside an existing Hadoop cluster; no new managed
  Postgres, no object-storage bucket to provision, no separate IdP.
- **Speaks MLflow out of the box.** Official Python, Java and R clients talk to Kirka
  unmodified — responses are emitted in MLflow's native `snake_case` wire format.
- **Authorization is not a stub.** Real Apache Ranger plugin (policies pushed from Ranger
  Admin, audited into the same Solr/HDFS sink as the rest of the stack). Basic Auth verifies
  passwords against a bcrypt htpasswd store; the Knox `X-Forwarded-User` header is honoured
  only from whitelisted proxy IPs.
- **Compliance-ready.** Append-only HBase audit log, GDPR hard-delete admin endpoint, OpenAPI
  schema served at `/v3/api-docs`.
- **Scales with HBase.** No SQL bottleneck; row-keyed access patterns for runs and metric
  history designed for 100M+ runs.

## Feature surface

| Area                              | Status                                                                 |
|-----------------------------------|------------------------------------------------------------------------|
| Experiments API                   | Complete (create, search, CRUD, tags, pagination, filter DSL)          |
| Runs API                          | Complete + `log-inputs`, `log-model`, get-metric-history               |
| Model Registry                    | Complete + aliases, rename, `get-download-uri`, `model-versions/search`|
| Artifact storage (HDFS)           | Complete, hardened against path traversal                              |
| Gateway (routes, secrets, tags)   | Registration yes — upstream proxy (LLM invocation) returns 501         |
| Model serving (`/invocations`)    | 501 by design (use dedicated serving runtime)                          |
| Audit log                         | `GET /api/2.0/kirka/audit/search` (admin)                              |
| GDPR hard-delete                  | `POST /api/2.0/kirka/gdpr/hard-delete` (admin)                         |
| Apache Ranger integration         | Real plugin, service-def shipped, audit wired                          |
| Kerberos / Knox                   | Supported, keytab mounted as K8s Secret                                |
| Prometheus metrics / Grafana pack | Shipped (`/actuator/prometheus` + dashboard JSON + alert rules)        |
| OpenAPI / Swagger UI              | `/v3/api-docs` and `/swagger-ui.html` (public)                         |

## Project coordinates

- `groupId`: `varga.foundation`
- `artifactId`: `kirka`
- `package`: `varga.kirka`
- OCI image: `ghcr.io/varga-foundation/kirka`
- Helm chart: `oci://ghcr.io/varga-foundation/charts/kirka`

## What you'll find here

- [Prerequisites and resources](./prerequisites-resources.md) — JDK, HBase, HDFS, Ranger
- [Installation and deployment](./installation-deployment.md) — Docker, Helm, values reference
- [Configuration](./configuration.md) — every tuneable property
- [Examples](./examples.md) — Python/Java client patterns, filter DSL, audit queries
- [Security](./security.md) — Basic Auth, Knox, Kerberos, actuator lockdown
- [Ranger setup](./ranger-setup.md) — policies and service-def
- [Audit log](./audit-log.md) — schema, retention, admin API
- [Observability](./observability.md) — metrics, Grafana pack, Prometheus rules
- [Operations](./operations.md) — scaling, logs, reconciliation, upgrades
- [Compatibility](./compatibility.md) — MLflow endpoint matrix
- [FAQ](./faq.md)
- [Troubleshooting](./troubleshooting.md)
