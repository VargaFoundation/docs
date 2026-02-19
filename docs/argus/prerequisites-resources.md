---
id: prerequisites-resources
title: Prerequisites and resources
sidebar_position: 3
---

## Build prerequisites

- CMake 3.16+
- C compiler (GCC, Clang, or MinGW)
- C++ compiler (for Kudu backend)
- pkg-config

## Library dependencies

| Library | Purpose | Required |
|---------|---------|----------|
| unixODBC | ODBC driver manager | Yes |
| GLib 2.0 | Core utilities | Yes |
| GIO 2.0 | Socket timeout support | Yes |
| Thrift C GLib | Hive/Impala backends | Optional |
| libcurl | Trino/Phoenix backends | Optional |
| json-glib | Trino/Phoenix backends | Optional |
| libkudu_client | Kudu backend | Optional |
| OpenSSL | SSL/TLS support | Optional |
| cmocka | Unit tests | Optional |

You only need the libraries for the backends you plan to use.

## Backend prerequisites

### Apache Hive
- HiveServer2 accessible on port 10000 (default)
- Thrift binary protocol enabled

### Apache Impala
- Impala daemon accessible on port 21050 (default)
- Thrift binary protocol enabled

### Trino
- Trino coordinator accessible on port 8080 (default)
- REST API enabled (default)

### Apache Phoenix
- Phoenix Query Server (PQS) accessible on port 8765 (default)
- PQS must be running with the Avatica JSON serialization (default)
- HBase cluster accessible from PQS

### Apache Kudu
- Kudu master server accessible on port 7051 (default)
- `libkudu_client` development package installed (`libkudu-client-dev` on Debian/Ubuntu, `kudu-client-devel` on RHEL/Fedora)

## Resources

- CPU: Minimal, driver runs in the client application process
- Memory: Proportional to `FetchBufferSize` (default 1000 rows per batch)
- Disk: Minimal, only needed for optional log files
