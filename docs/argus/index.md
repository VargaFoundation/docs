---
id: index
title: Introduction
sidebar_position: 1
---

Argus is a production-ready ODBC driver that provides SQL connectivity to multiple analytics query engines. It implements the ODBC 3.x API with a pluggable backend architecture supporting **ten backends** — Apache Hive, Apache Impala, Trino, Apache Phoenix, Apache Pinot, Apache Druid, Google BigQuery, MySQL-wire engines (StarRocks, Apache Doris, ClickHouse), Arrow Flight SQL (Dremio, InfluxDB 3) and Apache Kudu — plus an **Arrow ADBC driver** built over the same stack.

## Features

- **103 ODBC entry points** (69 ANSI + 34 Unicode `W` variants): ODBC 3.x API Level 1, plus ODBC 2.x compatibility (`SQLAllocConnect`, `SQLError`, `SQLExtendedFetch`, ...).
- **10 backends** through a single driver, enabled by dependency auto-detection at build time.
- **Statement-level asynchronous execution** (`SQL_ASYNC_MODE = SQL_AM_STATEMENT`, `SQLCompleteAsync`, `SQLCancelHandle`).
- **Arrow ADBC driver** (`libargus_adbc`) exposing the same backends through the Arrow C Data Interface — see [ADBC](./adbc.md).
- **BI tool support**: ODBC escape-sequence translation (`{fn ...}`, `{ts ...}`, `{oj ...}`) per backend dialect, plus a packaged [Power BI custom connector and Tableau connectors](./bi-tools.md) — verified with Tableau's TDVT (**91.4 %**). How Argus stacks up against Simba/Starburst: [How Argus compares](./comparison.md).
- **Authentication**: SASL PLAIN/LDAP, **Kerberos** (system GSSAPI on Linux/macOS, native SSPI on Windows), JWT/Bearer tokens (Databricks), and **OAuth2** for Trino — client credentials, device code (RFC 8628) and authorization code with PKCE + browser SSO, with OIDC discovery.
- **Cross-Platform**: Linux, macOS, and Windows x64.
- **SSL/TLS**: Secure connections with certificate verification (and mutual TLS) for all backends.
- **Connection Resilience**: Automatic retry, configurable timeouts, query cancellation.
- **Fetch performance**: configurable batching, block fetch (`SQL_ATTR_ROW_ARRAY_SIZE`), static scrollable cursors (`SQLFetchScroll`), and a **DOM-free Trino decode** (~65 % faster on large extracts).
- **Production Logging**: 7 log levels, thread-safe, file or stderr output.

## Architecture

Argus uses a two-layer pluggable architecture.

```
┌──────────────────────────────────────────────────┐
│                  Application                     │
│      ODBC / ADBC application or BI tool          │
└────────────────────┬─────────────────────────────┘
                     │
┌────────────────────▼─────────────────────────────┐
│               ODBC API Layer                     │
│  Handle Mgmt ─► Connect ─► Execute ─► Fetch      │
│  Catalog ─► Dialects & escape translation        │
│  Diagnostics ─► Logging                          │
└────────────────────┬─────────────────────────────┘
                     │  backend vtable
┌────────────────────▼─────────────────────────────┐
│              Backend Abstraction                 │
│  Hive · Impala · Trino · Phoenix · Pinot ·       │
│  Druid · BigQuery · MySQL-wire · Flight SQL ·    │
│  Kudu (deprecated)                               │
└──────────────────────────────────────────────────┘
```

**Layer 1 — ODBC API** (`src/odbc/`): Implements the ODBC specification. Handles environment, connection, and statement lifecycle, connection string parsing, type conversion, diagnostics, and the **per-backend SQL dialect table** — identifier quote character and ODBC escape-sequence translation, from which the `SQLGetInfo` capability bitmaps are derived. Never talks to a database directly.

**Layer 2 — Backend Abstraction** (`src/backend/`): Each backend implements the `argus_backend_t` vtable covering connection lifecycle, query execution, result fetching, catalog operations, and cancellation.

| `BACKEND=` | Engine | Protocol | Default port |
|------------|--------|----------|-------------|
| `hive` | Apache Hive — also Spark Thrift Server and Flink SQL Gateway (HiveServer2 protocol) | Thrift binary or HTTP | 10000 |
| `impala` | Apache Impala | Thrift binary | 21050 |
| `trino` | Trino | HTTP REST (JSON) | 8080 |
| `phoenix` | Apache Phoenix (Avatica/PQS) | HTTP/JSON | 8765 |
| `pinot` | Apache Pinot | HTTP/JSON | 8000 |
| `druid` | Apache Druid | HTTP/JSON | 8888 |
| `bigquery` | Google BigQuery — incl. sovereign clouds (S3NS): every Google endpoint is configurable | REST/JSON | — |
| `mysql` | StarRocks / Doris / ClickHouse / MySQL / MariaDB | MySQL wire | 3306 |
| `flightsql` | Dremio / InfluxDB 3 / any Arrow Flight SQL server | gRPC / Arrow | 32010 |
| `kudu` | Apache Kudu (**deprecated** — prefer `BACKEND=impala`) | kudu_client | 7051 |

## What you'll find here

- [Compatibility](./compatibility.md)
- [How Argus compares](./comparison.md)
- [Prerequisites and resources](./prerequisites-resources.md)
- [Installation and deployment](./installation-deployment.md)
- [Configuration](./configuration.md)
- [Security](./security.md)
- [Examples](./examples.md)
- [BI tools](./bi-tools.md)
- [ADBC driver](./adbc.md)
- [Deploying with Microsoft Intune](./intune-deployment.md)
- [Operations](./operations.md)
- [FAQ](./faq.md)
- [Troubleshooting](./troubleshooting.md)

Enable standard ODBC-based applications to query distributed SQL systems without backend-specific code.
