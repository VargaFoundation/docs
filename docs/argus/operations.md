---
id: operations
title: Operations
sidebar_position: 9
---

## Logging

Enable logging via connection string or environment variables:

```
LogLevel=5;LogFile=/var/log/argus.log
```

Or:

```bash
export ARGUS_LOG_LEVEL=5
export ARGUS_LOG_FILE=/var/log/argus.log
```

### Log levels

| Level | Name | Description |
|-------|------|-------------|
| 0 | OFF | No logging |
| 1 | FATAL | Fatal errors only |
| 2 | ERROR | Errors |
| 3 | WARN | Warnings |
| 4 | INFO | Informational messages |
| 5 | DEBUG | Debug details |
| 6 | TRACE | Full trace (verbose) |

Logging is thread-safe with mutex-protected operations on all platforms.

## Timeouts

| Parameter | Description |
|-----------|-------------|
| ConnectTimeout | Maximum time to establish a connection |
| QueryTimeout | Maximum time for a query to complete |
| SocketTimeout | Maximum time for socket read/write |

```
ConnectTimeout=30;QueryTimeout=600;SocketTimeout=120
```

## Connection retry

Automatic retry on connection failure:

```
RetryCount=3;RetryDelay=2
```

Diagnostics are cleared between attempts. Each attempt is logged.

## Query cancellation

Cancel long-running queries from another thread:

```c
SQLCancel(stmt);
```

This sends the appropriate cancellation request to each backend:
- **Trino**: DELETE `/v1/query/{id}`
- **Hive/Impala**: `TCancelOperationReq` via Thrift
- **Phoenix**: Avatica `closeStatement` RPC
- **Kudu**: Closes the `KuduScanner` immediately

## Fetch tuning

Adjust `FetchBufferSize` to control memory usage and network round trips:

```
FetchBufferSize=5000
```

Default is 1000 rows per batch. Increase for large result sets, decrease for low-latency queries.

## Monitoring

- Monitor log files for connection errors and query failures.
- Use `ApplicationName` to track queries in backend UIs (Trino UI, HiveServer2 logs).
- Track connection retry events at WARN level.

## Upgrades

- Replace `libargus_odbc.so` with the new build.
- No schema migrations needed (stateless driver).
- Update DSN configuration if new parameters are available.
