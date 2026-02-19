---
id: configuration
title: Configuration
sidebar_position: 5
---

## Registering with unixODBC

### Automatic

```bash
sudo bash scripts/install_dsn.sh
```

### Manual

Add to `/etc/odbcinst.ini`:

```ini
[Argus]
Description = Argus ODBC Driver for Hive, Impala, Trino, Phoenix, and Kudu
Driver = /usr/local/lib/libargus_odbc.so
Setup = /usr/local/lib/libargus_odbc.so
```

Add a DSN to `/etc/odbc.ini` or `~/.odbc.ini`:

```ini
[ArgusHive]
Description = Hive via Argus
Driver = Argus
HOST = localhost
PORT = 10000
UID = hive
PWD =
DATABASE = default
AUTHMECH = NOSASL
BACKEND = hive
```

## Connection string parameters

| Parameter | Aliases | Default | Description |
|-----------|---------|---------|-------------|
| HOST | SERVER | localhost | Server hostname or IP |
| PORT | | Per backend | Server port |
| UID | USERNAME, USER | (empty) | Username |
| PWD | PASSWORD | (empty) | Password |
| DATABASE | SCHEMA | default | Initial database/catalog |
| AUTHMECH | AUTH | NOSASL | Authentication mechanism |
| BACKEND | DRIVER_TYPE | hive | Backend: `hive`, `impala`, `trino`, `phoenix`, or `kudu` |
| SSL | UseSSL | false | Enable SSL/TLS |
| SSLCertFile | | - | Client certificate path |
| SSLKeyFile | | - | Client key path |
| SSLCAFile | | - | CA certificate path |
| SSLVerify | | true | Verify server certificate |
| LogLevel | | 0 | Log level (0=OFF to 6=TRACE) |
| LogFile | | stderr | Log file path |
| ConnectTimeout | | 0 | Connection timeout in seconds |
| QueryTimeout | | 0 | Query timeout in seconds |
| SocketTimeout | | 0 | Socket timeout in seconds |
| RetryCount | | 0 | Retry attempts on connect failure |
| RetryDelay | | 2 | Delay between retries in seconds |
| ApplicationName | AppName | - | Application identifier for query tracking |
| FetchBufferSize | | 1000 | Rows per fetch batch |

### Default ports by backend

| Backend | Default Port |
|---------|-------------|
| hive | 10000 |
| impala | 21050 |
| trino | 8080 |
| phoenix | 8765 |
| kudu | 7051 |

### Authentication mechanisms

| Value | Description |
|-------|-------------|
| NOSASL | No authentication (development/testing) |
| PLAIN | Username/password over SASL PLAIN |

## Backend-specific notes

### Hive

- Protocol: Thrift TCLIService (binary), protocol V10
- Database set via `use:database` config in OpenSession

### Impala

- Protocol: Thrift TCLIService (binary), protocol V6
- Database set via `USE <db>` statement after connect

### Trino

- Protocol: HTTP REST API (JSON)
- DATABASE maps to Trino catalog via `X-Trino-Catalog` header
- Catalog operations via `information_schema` queries

### Phoenix

- Protocol: Avatica HTTP/JSON via Phoenix Query Server (PQS)
- DATABASE maps to the Phoenix/HBase schema
- Catalog operations via Avatica RPCs (`getTables`, `getColumns`, `getSchemas`, `getCatalogs`, `getTypeInfo`)
- Requires Phoenix Query Server running on the target host

### Kudu

- Protocol: Kudu C++ client API (`libkudu_client`)
- HOST should point to the Kudu master server(s)
- DATABASE is used as a table name prefix (e.g., `database.table_name`)
- Only `SELECT` queries are supported (Kudu has no native SQL)
- The driver includes a minimal SQL parser supporting `SELECT`, `WHERE` (`=`, `<`, `>`, `<=`, `>=`, `IN`, `IS NULL`, `IS NOT NULL`), and `LIMIT`
- `JOIN`, `GROUP BY`, `ORDER BY`, subqueries, `INSERT`, `UPDATE`, and `DELETE` are not supported

## Parameter priority

When the same parameter is specified multiple ways:

1. Connection string (highest)
2. DSN configuration
3. Environment variable
4. Default value (lowest)

## Environment variables

```bash
export ARGUS_LOG_LEVEL=5    # Log level
export ARGUS_LOG_FILE=/tmp/argus.log  # Log file
```
