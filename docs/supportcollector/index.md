---
id: index
title: ODP Support Collector (ODPSC)
sidebar_position: 1
---

ODP Support Collector (ODPSC) is a diagnostic collection system for Hadoop clusters running on the ODP (Open Data Platform) distribution. It automates the collection, analysis, and transmission of diagnostic data from cluster nodes.

## Architecture

ODPSC uses a **Master-Agent** architecture deployed as an Apache Ambari Management Pack (mpack):

- **ODPSC Master**: A Flask/Gunicorn web server that receives bundles from agents, aggregates them, and optionally forwards them to SupportPlane or a support endpoint.
- **ODPSC Agent**: A collection daemon deployed on every cluster node that gathers diagnostics and uploads them to the master.

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│  ODPSC Agent│     │  ODPSC Agent│     │  ODPSC Agent│
│   (node-1)  │     │   (node-2)  │     │   (node-N)  │
└──────┬──────┘     └──────┬──────┘     └──────┬──────┘
       │                   │                   │
       │  Upload bundles (HTTP + API Key)      │
       └───────────────────┼───────────────────┘
                           │
                    ┌──────▼──────┐
                    │ ODPSC Master│
                    │  (master)   │
                    └──────┬──────┘
                           │
              ┌────────────┼────────────┐
              ▼            ▼            ▼
        ┌──────────┐ ┌──────────┐ ┌──────────────┐
        │   HDFS   │ │ Support  │ │ SupportPlane │
        │ Archive  │ │ Endpoint │ │  (optional)  │
        └──────────┘ └──────────┘ └──────────────┘
```

## Key Features

- **Multi-level Collection**: L1 (configs + system info), L2 (+ metrics + HDFS/YARN), L3 (+ full logs + thread dumps)
- **Sensitive Data Masking**: Automatic detection and masking of passwords, tokens, keys (JDBC, AWS, Azure, Kerberos, LDAP...)
- **Log Analysis**: Categorized Hadoop pattern detection with severity levels and recommendations
- **Bundle Deduplication**: UUID-based tracking prevents duplicate uploads
- **AES-256-GCM Encryption**: Optional encryption for bundles at rest
- **Audit Trail**: Comprehensive logging of all bundle operations
- **Retry with Backoff**: Exponential backoff for upload failures (up to 10 attempts)
- **SupportPlane Integration**: Forward aggregated bundles to a centralized support platform
- **Ambari Integration**: Full lifecycle management via Ambari UI

## Collection Levels

| Level | Content |
|-------|---------|
| **L1** | Configurations (masked), system info, cluster topology, service health, log tails (200 lines), Kerberos status, SSL certificates, kernel parameters |
| **L2** | Everything in L1 + CPU/memory/disk/network metrics, YARN queue status, HDFS report, alert history, JMX metrics, config drift detection |
| **L3** | Everything in L2 + complete logs (up to 7 days), thread dumps, GC logs |

## Next Steps

- [Installation](./installation.md)
- [Configuration](./configuration.md)
- [Usage](./usage.md)
- [API Reference](./api.md)
- [Troubleshooting](./troubleshooting.md)
