---
id: compatibility
title: Compatibility
sidebar_position: 2
---

## Tested versions

| Component | Version |
|-----------|---------|
| ODBC | 3.x API Level 1 (+ ODBC 2.x compatibility entry points) |
| unixODBC | 2.3.x |
| GLib | 2.56+ |
| CMake | 3.16+ |

## Supported backends

| Backend | `BACKEND=` | Protocol | Default Port | Notes |
|---------|-----------|----------|-------------|-------|
| Apache Hive | `hive` | Thrift TCLIService (V10), binary or HTTP | 10000 | HiveServer2 2.x, 3.x. Also serves **Spark Thrift Server**, **Flink SQL Gateway** and **Databricks** SQL warehouses (HiveServer2 protocol) |
| Apache Impala | `impala` | Thrift TCLIService (V6) | 21050 | Impala 3.x, 4.x |
| Trino | `trino` | HTTP REST API (JSON) | 8080 | Trino 400+ (v1), Trino 466+ (v2 spooling) |
| Apache Phoenix | `phoenix` | Avatica HTTP/JSON (PQS) | 8765 | Phoenix 5.x, PQS 6.x |
| Apache Pinot | `pinot` | HTTP/JSON (`/query/sql`) | 8000 (broker) | Validated end-to-end against a Pinot QuickStart cluster; table listing uses the controller (`:9000`) |
| Apache Druid | `druid` | HTTP/JSON (`/druid/v2/sql`) | 8888 (router) | Built on the validated Pinot/Trino HTTP-JSON pattern; broker is 8082 |
| Google BigQuery | `bigquery` | REST (`bigquery/v2`) | — | Public GCP, the BigQuery emulator, and sovereign clouds (e.g. S3NS) — every Google endpoint is configurable |
| MySQL-wire | `mysql` | MySQL client/server protocol | 3306 | **StarRocks** / **Apache Doris** (FE port 9030), **ClickHouse** (MySQL interface, port 9004), MySQL/MariaDB. Validated against MariaDB 11 |
| Arrow Flight SQL | `flightsql` | gRPC / Arrow Flight SQL | 32010 | **Dremio**, **InfluxDB 3** (port 8181), any Flight SQL server. Validated end-to-end against InfluxDB 3 Core |
| Apache Kudu | `kudu` | C++ Client API | 7051 | Kudu 1.15+. **Deprecated** — prefer `BACKEND=impala` (Impala queries Kudu tables natively) |

## Platforms

| Platform | Compiler | Status |
|----------|----------|--------|
| Linux (Ubuntu/Debian) | GCC | Supported (`.deb` packages, unixODBC) |
| Linux (Fedora/RHEL) | GCC | Supported |
| macOS | Clang | Supported |
| Windows (MSYS2/UCRT64) | MinGW | Supported — the installer ships Hive, Impala, Trino, Phoenix, Pinot, Druid, BigQuery and MySQL-wire; Flight SQL and Kudu need dependencies MSYS2 does not provide |

## ODBC entry points (103)

The driver exports 69 ANSI entry points plus 34 Unicode (`W`) variants — a
broader surface than the SimbaEngine core (89). See [How Argus compares](./comparison.md).

### Environment & Handle
- SQLAllocHandle, SQLFreeHandle
- ODBC 2.x: SQLAllocEnv, SQLAllocConnect, SQLAllocStmt, SQLFreeEnv, SQLFreeConnect

### Connection
- SQLConnect, SQLDriverConnect, SQLBrowseConnect, SQLDisconnect
- SQLGetConnectAttr, SQLSetConnectAttr

### Statement
- SQLExecDirect, SQLExecute, SQLPrepare, SQLCancel, SQLNativeSql
- **Asynchronous execution**: `SQL_ATTR_ASYNC_ENABLE` (`SQL_AM_STATEMENT`), SQLCompleteAsync, SQLCancelHandle (ODBC 3.8)
- SQLBindParameter, SQLNumParams, SQLDescribeParam, SQLParamData, SQLPutData
- SQLNumResultCols, SQLDescribeCol, SQLColAttribute (and ODBC 2.x SQLColAttributes)
- SQLFetch, **SQLFetchScroll**, SQLExtendedFetch, SQLGetData, SQLBindCol
- SQLSetPos, SQLBulkOperations, SQLSetScrollOptions
- SQLCloseCursor, SQLFreeStmt, SQLGetCursorName, SQLSetCursorName
- SQLSetStmtAttr, SQLGetStmtAttr, SQLRowCount, SQLMoreResults

### Catalog
- SQLTables, SQLColumns, SQLGetTypeInfo, SQLStatistics
- SQLPrimaryKeys, SQLForeignKeys, SQLProcedures, SQLProcedureColumns
- SQLSpecialColumns, SQLTablePrivileges, SQLColumnPrivileges

### Descriptors
- SQLGetDescField, SQLSetDescField, SQLGetDescRec, SQLSetDescRec, SQLCopyDesc
- Unicode: SQLGetDescFieldW, SQLSetDescFieldW, SQLGetDescRecW

### Info & Diagnostics
- SQLGetInfo, SQLGetDiagRec, SQLGetDiagField, SQLGetFunctions
- SQLSetEnvAttr, SQLGetEnvAttr, SQLEndTran (and ODBC 2.x SQLError, SQLTransact)

### Cursors and block fetch

- **Block fetch**: `SQL_ATTR_ROW_ARRAY_SIZE` rowsets and `SQL_ATTR_PARAMSET_SIZE` parameter arrays.
- **Static scrollable cursors**: `SQLFetchScroll` with NEXT/PRIOR/FIRST/LAST/ABSOLUTE/RELATIVE.

### Fetch performance

The Trino backend scans each result page **straight into cells without building
a JSON DOM** (the DOM was ~half of fetch time) — proven byte-identical to the
reference path and ~65 % faster end to end on large extracts. A kill-switch,
`ARGUS_TRINO_NOFASTJSON`, restores the DOM path. Numeric columns are kept as
native typed values so `SQLGetData` converts with no text round-trip, and Trino
v2 spooling is used where the server provides it.

## SQL dialects and identifier quoting

`SQLGetInfo(SQL_IDENTIFIER_QUOTE_CHAR)` is **dialect-aware** (since v0.5.9): ANSI double-quote (`"`) for Trino, Phoenix, Pinot and Druid; backtick (`` ` ``) for Hive, Impala, MySQL-wire and BigQuery. Tools that generate quoted SQL from this value (Power BI query folding, Tableau) get the right character per backend.

ODBC escape sequences (`{fn ...}`, `{d/t/ts ...}`, `{escape ...}`, `{oj ...}`, `{interval ...}`) are translated by the driver into each backend's grammar, and the scalar-function bitmaps reported by `SQLGetInfo` are derived from the same per-backend dialect table — the driver never advertises a function it cannot render. See [BI tools](./bi-tools.md).

## Type mapping

| Hive/Impala Type | Trino Type | Phoenix Type | Kudu Type | ODBC SQL Type |
|------------------|------------|--------------|-----------|---------------|
| BOOLEAN | boolean | BOOLEAN | BOOL | SQL_BIT |
| TINYINT | tinyint | TINYINT | INT8 | SQL_TINYINT |
| SMALLINT | smallint | SMALLINT | INT16 | SQL_SMALLINT |
| INT | integer | INTEGER | INT32 | SQL_INTEGER |
| BIGINT | bigint | BIGINT | INT64 | SQL_BIGINT |
| FLOAT | real | FLOAT | FLOAT | SQL_FLOAT / SQL_REAL |
| DOUBLE | double | DOUBLE | DOUBLE | SQL_DOUBLE |
| STRING / VARCHAR | varchar | VARCHAR | STRING / VARCHAR | SQL_VARCHAR |
| TIMESTAMP | timestamp | TIMESTAMP | UNIXTIME_MICROS | SQL_TYPE_TIMESTAMP |
| DATE | date | DATE | DATE | SQL_TYPE_DATE |
| DECIMAL | decimal | DECIMAL | DECIMAL | SQL_DECIMAL |
| BINARY | varbinary | VARBINARY / BINARY | BINARY | SQL_BINARY / SQL_VARBINARY |
| ARRAY / MAP / STRUCT | array / map / row | ARRAY | - | SQL_VARCHAR (JSON) |

Complex types (ARRAY, MAP, STRUCT) are serialized as JSON strings.

The HTTP/JSON backends (Pinot, Druid, BigQuery) and MySQL-wire map their native types onto the same ODBC SQL type set. The Flight SQL backend keeps numeric columns as **native typed values** (no per-cell string), so `SQLGetData` converts straight to the requested C type.

Timestamp values are accepted both as `YYYY-MM-DD HH:MM:SS[.fff]` and as ISO-8601 with a `T` separator (as emitted by Druid).

### Phoenix-specific types

Phoenix also supports unsigned variants (`UNSIGNED_TINYINT`, `UNSIGNED_SMALLINT`, `UNSIGNED_INT`, `UNSIGNED_LONG`, `UNSIGNED_FLOAT`, `UNSIGNED_DOUBLE`, `UNSIGNED_DATE`, `UNSIGNED_TIME`, `UNSIGNED_TIMESTAMP`) which map to their signed ODBC equivalents.

### Kudu-specific types

Kudu uses `UNIXTIME_MICROS` for timestamps (microsecond precision since epoch). The Kudu backend converts these to standard `YYYY-MM-DD HH:MM:SS.ffffff` format.
