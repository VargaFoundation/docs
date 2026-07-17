---
id: prerequisites-resources
title: Prerequisites and resources
sidebar_position: 3
---

## Build prerequisites

- CMake 3.16+
- C compiler (GCC, Clang, or MinGW)
- C++ compiler (only for the Flight SQL and Kudu backends; Flight SQL needs GCC 14+ / C++20)
- pkg-config

## Library dependencies

| Library | Purpose | Required |
|---------|---------|----------|
| unixODBC | ODBC driver manager (Linux/macOS) | Yes |
| GLib 2.0 / GIO 2.0 | Core utilities, socket transport and timeouts | Yes |
| Thrift C GLib | Hive/Impala backends | Optional |
| libcurl | Trino/Phoenix/Pinot/Druid/BigQuery backends | Optional |
| json-glib | Trino/Phoenix/Pinot/Druid/BigQuery backends | Optional |
| libmariadb | MySQL-wire backend (StarRocks/Doris/ClickHouse) | Optional |
| arrow-flight-sql (C++) | Flight SQL backend (Dremio/InfluxDB 3) | Optional |
| libkudu_client | Kudu backend (deprecated) | Optional |
| OpenSSL | SSL/TLS for Thrift; BigQuery service-account keys (RS256) | Optional |
| GSSAPI (system) | Kerberos for Hive/Impala on Linux/macOS (SSPI is used on Windows) | Optional |
| glib-networking | TLS module for the GIO transport on Windows (bundled by the installer) | Optional |
| cmocka | Unit tests | Optional |

Backends are enabled by **auto-detection** of these dependencies at CMake time — you only need the libraries for the backends you plan to use.

## Backend prerequisites

### Apache Hive (also Spark / Flink / Databricks)
- HiveServer2 accessible on port 10000 (default), Thrift binary protocol — or HTTP transport (`TransportMode=HTTP`)
- Spark Thrift Server and Flink SQL Gateway (`hiveserver2` endpoint) speak the same protocol: use `BACKEND=hive`

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

### Apache Pinot
- Pinot broker accessible on port 8000 (default) for queries
- Pinot controller accessible on port 9000 (same host) for table listing

### Apache Druid
- Druid router (port 8888) or broker (port 8082) accessible
- SQL endpoint (`/druid/v2/sql`) enabled (default)

### Google BigQuery
- A GCP project id (`Project=`)
- A service-account JSON key (`BQKeyFile=`), a pre-fetched token (`AccessToken=`), or an unauthenticated emulator endpoint
- For sovereign clouds: the deployment's API/token endpoints and its CA certificate

### MySQL-wire (StarRocks / Doris / ClickHouse)
- The engine's MySQL protocol port: StarRocks/Doris FE `9030`, ClickHouse `9004`, MySQL/MariaDB `3306`

### Arrow Flight SQL (Dremio / InfluxDB 3)
- A Flight SQL endpoint: Dremio `32010` (default), InfluxDB 3 `8181`
- A build with `libarrow-flight-sql-dev` (Apache Arrow APT repo)

### Apache Kudu (deprecated)
- Prefer reaching Kudu tables through Impala (`BACKEND=impala`)
- If used directly: Kudu master on port 7051 and `libkudu_client` installed — note it is **not packaged for any Ubuntu newer than 16.04**

## Resources

- CPU: Minimal, driver runs in the client application process
- Memory: Proportional to `FetchBufferSize` (default 1000 rows per batch); Flight SQL streams record batches lazily with bounded memory
- Disk: Minimal, only needed for optional log files
