---
id: troubleshooting
title: Troubleshooting
sidebar_position: 11
---

## Common issues

### Connection fails

- Enable trace logging: `LogLevel=6;LogFile=/tmp/argus.log`
- Check firewall rules and network reachability.
- Verify `HOST`, `PORT`, and `BACKEND` values.
- Try retry: `RetryCount=3;RetryDelay=2`

### SSL errors

- Verify certificate paths are absolute and readable.
- Check certificate validity and expiration.
- Try `SSLVerify=0` for testing (never in production).
- Ensure the backend has SSL/TLS enabled on its side.

### Query hangs

- Set a timeout: `QueryTimeout=300`
- Use `SQLCancel` from another thread.
- Check backend logs for stuck queries.

### Wrong backend selected

- Verify the `BACKEND` parameter is set (`hive`, `impala`, `trino`, `phoenix`, or `kudu`).
- Default is `hive` if not specified.

### Type conversion errors

- Check the source column type against the bound C type.
- Enable DEBUG logging to see conversion details.
- Complex types (ARRAY, MAP, STRUCT) are returned as JSON strings.

### Driver not found

- Verify `/etc/odbcinst.ini` has an `[Argus]` section.
- Check the `Driver` path points to the actual `libargus_odbc.so` location.
- Run `odbcinst -q -d` to list registered drivers.

### isql returns "Data source name not found"

- Verify `/etc/odbc.ini` or `~/.odbc.ini` has the DSN defined.
- Run `odbcinst -q -s` to list registered DSNs.

### Phoenix-specific issues

- **Avatica error: connection refused**: Ensure Phoenix Query Server is running on the specified host and port (default 8765).
- **Avatica error: no such connection**: The PQS connection may have timed out. Reconnect and retry.
- **Empty result sets**: Verify the Phoenix table exists and has data. Use the Phoenix `sqlline` tool to test queries directly.

### Kudu-specific issues

- **SQL parse error**: The Kudu backend only supports basic `SELECT ... FROM ... WHERE ... LIMIT` syntax. `JOIN`, `GROUP BY`, `ORDER BY`, subqueries, and DML statements are not supported.
- **Table not found**: Verify the table name matches exactly (Kudu table names are case-sensitive). If using a DATABASE prefix, ensure it matches the table namespace in Kudu.
- **Column not found in predicate**: Column names in `WHERE` clauses must match the Kudu schema exactly (case-sensitive).
- **Connection to master failed**: Verify the Kudu master is reachable on the specified host and port (default 7051). Check that `libkudu_client` is installed.

## Debug tips

- Set `LogLevel=6` for maximum verbosity.
- Check log output for Thrift, HTTP, or Kudu client errors.
- Use `isql -v <DSN>` to test connectivity.
- Verify the shared library exports: `nm -D libargus_odbc.so | grep SQL`
