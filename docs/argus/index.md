---
id: index
title: Introduction
sidebar_position: 1
---

Argus is a production-ready ODBC driver that provides SQL connectivity to multiple big data query engines. It implements the ODBC 3.x API specification with a pluggable backend architecture supporting Apache Hive, Apache Impala, Trino, Apache Phoenix, and Apache Kudu.

## Features

- **52 ODBC Functions**: Full ODBC 3.x API Level 1 implementation.
- **Multiple Backends**: Apache Hive, Apache Impala, Trino, Apache Phoenix, and Apache Kudu via a single driver.
- **Cross-Platform**: Linux, macOS, and Windows support.
- **SSL/TLS**: Secure connections with certificate verification for all backends.
- **Connection Resilience**: Automatic retry, configurable timeouts, query cancellation.
- **Production Logging**: 7 log levels, thread-safe, file or stderr output.

## Architecture

Argus uses a two-layer pluggable architecture.

```
┌──────────────────────────────────────────────────┐
│                  Application                     │
│          ODBC Application / BI Tool              │
└────────────────────┬─────────────────────────────┘
                     │
┌────────────────────▼─────────────────────────────┐
│               ODBC API Layer                     │
│  Handle Mgmt ─► Connect ─► Execute ─► Fetch     │
│  Catalog ─► Diagnostics ─► Logging               │
└────────────────────┬─────────────────────────────┘
                     │
┌────────────────────▼─────────────────────────────┐
│          vtable Interface (13 fn ptrs)           │
├──────────┬──────────┬───────┬─────────┬──────────┤
│   Hive   │  Impala  │ Trino │ Phoenix │   Kudu   │
│  Thrift  │  Thrift  │ REST  │ Avatica │ C++ API  │
│  V10     │  V6      │ JSON  │  JSON   │ Scanner  │
│  :10000  │  :21050  │ :8080 │  :8765  │  :7051   │
└──────────┴──────────┴───────┴─────────┴──────────┘
```

**Layer 1 — ODBC API** (`src/odbc/`): Implements the ODBC specification. Handles environment, connection, and statement lifecycle, connection string parsing, type conversion, and diagnostics. Never talks to a database directly.

**Layer 2 — Backend Abstraction** (`src/backend/`): Each backend implements the `argus_backend_t` vtable with 13 function pointers covering connection lifecycle, query execution, result fetching, and catalog operations.

## What you'll find here

- [Prerequisites and resources](./prerequisites-resources.md)
- [Installation and deployment](./installation-deployment.md)
- [Configuration](./configuration.md)
- [Examples](./examples.md)
- [Security](./security.md)
- [Operations](./operations.md)
- [Compatibility](./compatibility.md)
- [FAQ](./faq.md)
- [Troubleshooting](./troubleshooting.md)

Enable standard ODBC-based applications to query distributed SQL systems without backend-specific code.
