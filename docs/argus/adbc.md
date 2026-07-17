---
id: adbc
title: ADBC driver
sidebar_position: 9
---

Argus exposes an [Arrow ADBC](https://arrow.apache.org/adbc/) surface (`libargus_adbc.so`) layered over its existing, validated ODBC stack. A query's result is returned as an Arrow **C Data Interface** stream of typed columns, so Arrow-native consumers (Power BI/Fabric's ADBC path, the Python/R ADBC bindings, DuckDB, etc.) get columnar data directly.

This anticipates the industry shift to ADBC — note what that shift is and is not: Power BI/Fabric is moving to ADBC by default and retiring the ODBC drivers it **embeds**, but Microsoft [states](https://learn.microsoft.com/en-us/power-query/transition-to-adbc) that the transition "doesn't change behavior for the ODBC connector when you use a separately installed ODBC driver". Argus is separately installed, so its ODBC path and its Power BI connector are unaffected; the ADBC surface is an addition, not a migration. See [BI tools](./bi-tools.md).

## Design

The driver is a thin Arrow adapter, not a reimplementation: a connection is an Argus ODBC connection (`SQLDriverConnect` with the usual `BACKEND=...;HOST=...` string), and `AdbcStatementExecuteQuery` runs the SQL through `SQLExecDirect`/`SQLFetch` and emits the rows as an `ArrowArrayStream`. Every backend, the streaming fetch and the native typed cells are reused unchanged.

The Arrow C Data Interface is a stable, dependency-free ABI, so the driver emits it **without linking any Arrow library**.

## Type mapping

| SQL type | Arrow type | C Data format |
|---|---|---|
| TINYINT/SMALLINT/INTEGER/BIGINT | int64 | `l` |
| REAL/FLOAT/DOUBLE | double | `g` |
| BIT | bool | `b` |
| DATE | date32 (days) | `tdD` |
| TIMESTAMP | timestamp, microseconds | `tsu:` |
| everything else (incl. DECIMAL) | utf8 | `u` |

DECIMAL stays utf8 to preserve arbitrary precision.

## Capabilities

- **ADBC 1.0.0 vtable** (`AdbcDriverInit`), so the driver loads via any ADBC driver manager by name.
- **Batched streaming**: the result statement stays open and each `get_next` pulls one Arrow batch (up to 4096 rows) lazily — memory is bounded regardless of result size.
- **Bound parameters** (`AdbcStatementBind`): the Arrow parameter array (row 0) is decoded and substituted into the query's `?` markers as SQL literals.
- **Metadata**: `AdbcConnectionGetTableSchema` (a table's columns as an Arrow schema, via `SQLColumns`), `AdbcConnectionGetTableTypes`, and `AdbcConnectionGetObjects` (the nested catalog/schema/table/column schema, with the catalog level populated; deeper levels are a follow-up).

## Usage

```c
#include "argus/adbc.h"

struct AdbcError err = {0};
struct AdbcDatabase db = {0};
AdbcDatabaseNew(&db, &err);
AdbcDatabaseSetOption(&db, "uri",
    "BACKEND=trino;HOST=trino;PORT=8080;UID=analyst;Database=tpch", &err);
AdbcDatabaseInit(&db, &err);

struct AdbcConnection conn = {0};
AdbcConnectionNew(&conn, &err);
AdbcConnectionInit(&conn, &db, &err);

struct AdbcStatement stmt = {0};
AdbcStatementNew(&conn, &stmt, &err);
AdbcStatementSetSqlQuery(&stmt, "SELECT * FROM tpch.tiny.nation", &err);

struct ArrowArrayStream stream = {0};
int64_t rows_affected = 0;
AdbcStatementExecuteQuery(&stmt, &stream, &rows_affected, &err);
/* consume `stream` with any Arrow C Data Interface importer */
```

## Building and testing

Built with `-DBUILD_ADBC=ON` (the default). The integration test (`tests/integration/test_adbc.cpp`) runs the whole surface against a live Trino and imports every result with Arrow C++'s own `ImportRecordBatchReader`/`ImportSchema` — the reference C Data Interface validator.
