---
id: compatibility
title: Compatibility
sidebar_position: 2
---

## Tested versions

| Component | Version |
|-----------|---------|
| ODBC | 3.x API Level 1 |
| unixODBC | 2.3.x |
| GLib | 2.56+ |
| CMake | 3.16+ |

## Supported backends

| Backend | Protocol | Default Port | Tested Versions |
|---------|----------|-------------|-----------------|
| Apache Hive | Thrift TCLIService (V10) | 10000 | HiveServer2 2.x, 3.x |
| Apache Impala | Thrift TCLIService (V6) | 21050 | Impala 3.x, 4.x |
| Trino | HTTP REST API (JSON) | 8080 | Trino 400+ |
| Apache Phoenix | Avatica HTTP/JSON (PQS) | 8765 | Phoenix 5.x, PQS 6.x |
| Apache Kudu | C++ Client API | 7051 | Kudu 1.15+ |

## Platforms

| Platform | Compiler | Status |
|----------|----------|--------|
| Linux (Ubuntu/Debian) | GCC | Supported |
| Linux (Fedora/RHEL) | GCC | Supported |
| macOS | Clang | Supported |
| Windows (MSYS2/UCRT64) | MinGW | Supported |

## ODBC functions implemented (52)

### Environment & Handle
- SQLAllocHandle, SQLFreeHandle

### Connection
- SQLConnect, SQLDriverConnect, SQLDisconnect, SQLGetConnectAttr, SQLSetConnectAttr

### Statement
- SQLExecDirect, SQLExecute, SQLPrepare, SQLCancel
- SQLNumResultCols, SQLDescribeCol, SQLColAttribute
- SQLFetch, SQLGetData, SQLBindCol, SQLCloseCursor, SQLFreeStmt
- SQLSetStmtAttr, SQLGetStmtAttr, SQLRowCount, SQLMoreResults, SQLNumParams

### Catalog
- SQLTables, SQLColumns, SQLGetTypeInfo, SQLStatistics
- SQLPrimaryKeys, SQLForeignKeys, SQLProcedures, SQLProcedureColumns
- SQLSpecialColumns, SQLTablePrivileges, SQLColumnPrivileges

### Info & Diagnostics
- SQLGetInfo, SQLGetDiagRec, SQLGetDiagField, SQLGetFunctions
- SQLSetEnvAttr, SQLGetEnvAttr, SQLEndTran

### Driver
- SQLDrivers, SQLDataSources

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

### Phoenix-specific types

Phoenix also supports unsigned variants (`UNSIGNED_TINYINT`, `UNSIGNED_SMALLINT`, `UNSIGNED_INT`, `UNSIGNED_LONG`, `UNSIGNED_FLOAT`, `UNSIGNED_DOUBLE`, `UNSIGNED_DATE`, `UNSIGNED_TIME`, `UNSIGNED_TIMESTAMP`) which map to their signed ODBC equivalents.

### Kudu-specific types

Kudu uses `UNIXTIME_MICROS` for timestamps (microsecond precision since epoch). The Kudu backend converts these to standard `YYYY-MM-DD HH:MM:SS.ffffff` format.
