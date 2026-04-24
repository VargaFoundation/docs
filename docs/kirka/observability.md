---
id: observability
title: Observability
sidebar_position: 12
---

Pre-built artefacts for plugging Kirka into a Prometheus + Grafana stack. They consume
metrics emitted out of the box — no code changes required.

## What gets exposed

The Spring Boot application publishes on `/actuator/prometheus`:

| Metric                                 | Source                                          | Dimensions                                        |
|----------------------------------------|-------------------------------------------------|---------------------------------------------------|
| `http_server_requests_seconds`         | Spring Boot Actuator default                    | `uri`, `method`, `status`, `outcome`, `exception` |
| `kirka_hbase_operations_seconds`       | `RepositoryTimingAspect`                        | `repository`, `operation`, `outcome`              |
| `kirka_repair_orphans_total`           | `ExperimentIndexReconciler`                     | `service=kirka`                                   |
| `jvm_memory_*`, `jvm_gc_*`, `process_*`| Micrometer JVM binders, default Spring Boot setup | —                                               |

## Grafana dashboard

Import `docs/observability/grafana-dashboard.json` directly (Dashboards → Import in the
Grafana UI). The dashboard exposes one template variable, `prometheus`, which must point
at your cluster's scrape-target datasource.

Panels cover: replicas up, API throughput, HTTP error ratio, MLflow API latency buckets,
HBase op latency per method, HBase success/failure rate, reconciler activity, heap
utilisation, GC pause.

## Prometheus alert rules

`docs/observability/prometheus-rules.yaml` is structured for the Prometheus Operator
(`PrometheusRule` CRD), but the same YAML is also valid under a vanilla Prometheus
`rule_files:` entry.

Shipped alerts (critical / warning):

| Alert                           | Fires when                                                           |
|---------------------------------|----------------------------------------------------------------------|
| `KirkaInstanceDown`             | A replica stops scraping for 2 min                                   |
| `KirkaAtLeastOneReplicaUnhealthy` | More than 50% of replicas are down for 5 min                       |
| `KirkaHighErrorRate`            | 5xx > 2% of total traffic over 10 min                                |
| `KirkaSlowAPI`                  | p99 latency on `/api/2.0/*` > 1 s for 10 min                         |
| `KirkaHBaseFailureRate`         | `outcome=failure` rate on HBase ops > 1% over 10 min                 |
| `KirkaOrphanIndexBuildingUp`    | > 50 orphan index rows cleaned in the last hour                      |
| `KirkaHeapExhaustion`           | Heap > 90% for 15 min                                                |
| `KirkaAuthorizationDeniedSpike` | Ranger denial rate 3× above the 1 h baseline                         |
| `KirkaBasicAuthFailuresSpike`   | > 50 Basic-auth failures in 5 min (possible brute-force)             |

Tune thresholds against 2–4 weeks of baseline data before enabling paging.

## Wiring with Prometheus Operator

The Helm chart includes a ServiceMonitor template guarded by `serviceMonitor.enabled`:

```yaml
# values.yaml
serviceMonitor:
  enabled: true
  interval: 30s
  path: /actuator/prometheus
  labels:
    release: kube-prometheus-stack
```

Then ship the `PrometheusRule` in the same namespace — Helm doesn't package it by default
because alert thresholds are deployment-specific.

## Correlation IDs

Every HTTP request carries an `X-Request-Id` header (generated if the caller didn't
supply one) that also lands in SLF4J's MDC as `request_id`. The default log pattern and
the JSON Logstash encoder both include it, so grepping for an id links the HTTP entry
point to every downstream log line and the corresponding audit-log rows.

## What is not covered yet

- Business counters (`kirka_experiments_created_total`, `kirka_runs_created_total`, …)
  are declared in `MetricsConfig` but not yet incremented — tracked as a follow-up to the
  `RepositoryTimingAspect` work.
- Tracing: no OpenTelemetry exporters are configured. Correlation IDs from
  `MdcCorrelationFilter` are visible in logs but not exported as spans.
- Ranger audit events flow into Ranger's own pipeline (Solr/HDFS) — see
  [Ranger setup](./ranger-setup.md) for the dashboard side of that.
