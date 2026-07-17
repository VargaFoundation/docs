---
id: troubleshooting
title: Troubleshooting
sidebar_position: 13
---

## Common issues

### Connection fails

- Enable trace logging: `LogLevel=6;LogFile=/tmp/argus.log`
- Check firewall rules and network reachability.
- Verify `HOST`, `PORT`, and `BACKEND` values.
- Try retry: `RetryCount=3;RetryDelay=2`

### unixODBC reports IM005 ("Driver's SQLAllocHandle failed")

Fixed in **v0.5.8** — earlier versions failed under the unixODBC Driver Manager (which blocked isql and every Linux BI tool). Upgrade the driver; there is no workaround for older builds.

### SSL errors

- Verify certificate paths are absolute and readable.
- Check certificate validity and expiration.
- Try `SSLVerify=0` for testing (never in production).
- Ensure the backend has SSL/TLS enabled on its side.
- BigQuery on a sovereign cloud: `SSLCAFile` must carry the deployment's private CA — it is used for both the API and the token endpoint.

### Query hangs

- Set a timeout: `QueryTimeout=300`
- Use `SQLCancel` from another thread.
- Check backend logs for stuck queries.

### Wrong backend selected

- Verify the `BACKEND` parameter is set (`hive`, `impala`, `trino`, `phoenix`, `pinot`, `druid`, `bigquery`, `mysql`, `flightsql`, or `kudu`).
- Default is `hive` if not specified.

### Type conversion errors

- Check the source column type against the bound C type.
- Enable DEBUG logging to see conversion details.
- Complex types (ARRAY, MAP, STRUCT) are returned as JSON strings.
- ISO-8601 timestamps with a `T` separator (e.g. from Druid) are accepted since v0.5.8.

### Driver not found

- Verify `/etc/odbcinst.ini` has an `[Argus]` section.
- Check the `Driver` path points to the actual `libargus_odbc.so` location.
- Run `odbcinst -q -d` to list registered drivers.

### isql returns "Data source name not found"

- Verify `/etc/odbc.ini` or `~/.odbc.ini` has the DSN defined.
- Run `odbcinst -q -s` to list registered DSNs.

## BI tool issues

### Power BI query folding broken / quoted identifiers rejected

Fixed in **v0.5.9**: `SQL_IDENTIFIER_QUOTE_CHAR` is now dialect-aware. Earlier versions reported a backtick for every backend, which broke Power BI query folding on Trino, Phoenix, Pinot and Druid (which need the ANSI double-quote). Upgrade the driver.

### Power BI: "Keep Top N" does not fold / no DirectQuery

Generic ODBC cannot fold `LIMIT`/`TOP` in Power Query — that is a Power Query architecture limit. Install the [Argus custom connector](./bi-tools.md#power-bi).

### A tool's `{fn ...}` query is rejected with 42000

The backend's dialect cannot render that function, and the driver refuses to forward it (a clear driver error beats an opaque server syntax error). If the server *does* support the function, this is a dialect-table bug in the driver — please report it.

### Windows: Add-OdbcDsn fails with UID/PWD

The Windows ODBC Manager rejects `UID`/`PWD` in DSN properties. Supply credentials at connect time or in a DSN-less connection string.

## Authentication issues

- **Kerberos (Hive/Impala)**: verify a ticket exists (`klist`; on Windows the domain logon provides it). If the SPN differs from `service/<HOST>`, set `KrbServiceName`, `KrbHostFQDN` or `KrbRealm`.
- **Trino Basic/LDAP rejected**: HTTP Basic requires TLS — set `SSL=1`.
- **Trino OAuth2 401 loops**: the token is auto-refreshed once on 401; persistent 401 means the IdP client/scope configuration is wrong. Enable `LogLevel=5` to see the token exchanges.
- **BigQuery**: check `Project` is set, and that `BQKeyFile` is readable and its service account has BigQuery permissions.

## Backend-specific issues

### Phoenix

- **Avatica error: connection refused**: Ensure Phoenix Query Server is running on the specified host and port (default 8765).
- **Avatica error: no such connection**: The PQS connection may have timed out. Reconnect and retry.
- **Empty result sets**: Verify the Phoenix table exists and has data. Use the Phoenix `sqlline` tool to test queries directly.

### Trino v2 spooling

- **"Unsupported spooling encoding"**: The driver only supports `json` encoding. Compressed encodings (`json+zstd`, `json+lz4`) are not yet supported. Ensure your Trino server is not forcing compressed encoding.
- **Spooled segment fetch fails**: The spooled segment URI may have expired or the coordinator may be unreachable. Check network connectivity and segment TTLs.
- **Mixed v1/v2 responses**: This is normal. Even with `TrinoProtocol=v2`, the server may return v1-format data for some responses.
- **v2 not working**: Verify Trino is 466+, `TrinoProtocol=v2` is set, and (with `LogLevel=5`) that the `X-Trino-Client-Capabilities` header is sent.

### Pinot

- **Connection works but no tables**: table listing goes through the **controller** on port 9000 of the same host — ensure it is reachable, not just the broker.
- Query errors surface the real Pinot message in the diagnostics.

### Druid

- **Connection refused**: point `HOST`/`PORT` at the **router** (8888) or a broker (8082), not the coordinator.
- Query errors surface Druid's `errorMessage`.

### MySQL-wire (StarRocks / Doris / ClickHouse)

- **Connection refused**: set `PORT` explicitly — StarRocks/Doris FE listen on `9030` and ClickHouse's MySQL interface on `9004`, not 3306.
- **No schemas listed**: a database is reported as an ODBC *catalog* (`TABLE_CAT`), with the schema column empty — the MySQL Connector/ODBC convention. Look under catalogs in your tool.
- **ClickHouse rejects a function**: ClickHouse's SQL is not MySQL's; the driver already refuses the escapes that differ, but tool-generated raw SQL may still not apply. Prefer generic/DSN usage over the MySQL-dialect connectors for ClickHouse.

### Flight SQL

- **Connection fails**: verify the Flight SQL port (Dremio 32010, InfluxDB 3 8181) and whether the server requires TLS (`SSL=1`).
- **InfluxDB 3**: pass the target database via `DATABASE` (sent as the gRPC `database` header) and the token via `PWD`.

### Kudu (deprecated)

- Prefer `BACKEND=impala`. If using the direct backend: only basic `SELECT ... FROM ... WHERE ... LIMIT` parses; table and column names are case-sensitive; verify the master is reachable on 7051 and `libkudu_client` is installed.

## Debug tips

- Set `LogLevel=6` for maximum verbosity.
- Check log output for Thrift, HTTP, gRPC, or MySQL client errors.
- Use `isql -v <DSN>` to test connectivity (requires driver v0.5.8+).
- Verify the shared library exports: `nm -D libargus_odbc.so | grep SQL`
